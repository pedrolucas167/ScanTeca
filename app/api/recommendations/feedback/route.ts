import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/book-metadata";
import { readJson } from "@/lib/validation";
import { rateLimitGuard } from "@/lib/rate-limit";
import { invalidateRecommendationsCache } from "@/lib/recommendations-cache";
import { z } from "zod";

const feedbackSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório"),
  author: z.string().trim().min(1, "Autor é obrigatório"),
  kind: z.enum(["WANT", "DISMISSED"]),
  source: z.string().trim().optional(),
});

const upsertRateLimit = {
  route: "recommendations/feedback",
  userLimit: 50,
  ipLimit: 100,
  windowMs: 60_000,
};

function normalizeForMatch(text: string): string {
  return normalize(text).join(" ");
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      userId,
      ...upsertRateLimit,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, feedbackSchema);
    if (!parsed.ok) return parsed.response;

    const { title, author, kind, source } = parsed.data;
    const normalizedTitle = normalizeForMatch(title);
    const normalizedAuthor = normalizeForMatch(author);

    if (!normalizedTitle) {
      return NextResponse.json(
        { error: "Título normalizado é inválido" },
        { status: 400 }
      );
    }

    const feedback = await prisma.recommendationFeedback.upsert({
      where: {
        userId_normalizedTitle_normalizedAuthor: {
          userId,
          normalizedTitle,
          normalizedAuthor,
        },
      },
      create: {
        userId,
        title: title.slice(0, 255),
        author: author.slice(0, 255),
        normalizedTitle,
        normalizedAuthor,
        kind,
        source,
      },
      update: { kind, source, updatedAt: new Date() },
    });

    await invalidateRecommendationsCache(userId);

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("[recommendations/feedback] POST error:", error);
    return NextResponse.json(
      { error: "Erro ao salvar feedback" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const title = searchParams.get("title")?.trim();
    const author = searchParams.get("author")?.trim();

    if (!title || !author) {
      return NextResponse.json(
        { error: "Título e autor são obrigatórios" },
        { status: 400 }
      );
    }

    const normalizedTitle = normalizeForMatch(title);
    const normalizedAuthor = normalizeForMatch(author);

    await prisma.recommendationFeedback.deleteMany({
      where: {
        userId,
        normalizedTitle,
        normalizedAuthor,
      },
    });

    await invalidateRecommendationsCache(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[recommendations/feedback] DELETE error:", error);
    return NextResponse.json(
      { error: "Erro ao remover feedback" },
      { status: 500 }
    );
  }
}
