import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildRecommendations } from "@/lib/recommendations";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "recommendations",
      userId,
      ...rateLimits.recommendations,
    });
    if (rateLimit) return rateLimit;

    const data = await buildRecommendations(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erro em GET /api/recommendations:", error);
    return NextResponse.json(
      { error: "Erro ao gerar recomendações" },
      { status: 500 }
    );
  }
}
