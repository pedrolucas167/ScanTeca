import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { scrapingQueue } from "@/lib/scraping-queue";
import { rateLimitGuard } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await rateLimitGuard(request, {
    route: "scraping/enqueue",
    userId,
    userLimit: 10,
    ipLimit: 30,
    windowMs: 60_000,
  });

  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = await request.json();
    const { url, source, type = "metadata", priority = 5, metadata } = body;

    if (!url || !source) {
      return NextResponse.json(
        { error: "Missing required fields: url, source" },
        { status: 400 }
      );
    }

    const jobId = await scrapingQueue.enqueue({
      url,
      source,
      type: type as "book" | "article" | "review" | "metadata",
      priority,
      maxAttempts: 3,
      userId,
      metadata,
    });

    return NextResponse.json({ jobId, status: "enqueued" }, { status: 201 });
  } catch (error) {
    console.error("Failed to enqueue scraping job:", error);
    return NextResponse.json(
      { error: "Failed to enqueue scraping job" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const queueSize = await scrapingQueue.getQueueSize();
    const processingCount = await scrapingQueue.getProcessingCount();

    return NextResponse.json({
      queueSize,
      processingCount,
    });
  } catch (error) {
    console.error("Failed to get queue status:", error);
    return NextResponse.json(
      { error: "Failed to get queue status" },
      { status: 500 }
    );
  }
}
