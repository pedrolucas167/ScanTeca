import { NextRequest, NextResponse } from "next/server";
import { ScrapingWorker } from "@/lib/scraping-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const outcome = await new ScrapingWorker().runOnce();
  return NextResponse.json({ ok: outcome !== "error", outcome }, { status: outcome === "error" ? 503 : 200 });
}
