import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRecommendations } from "@/lib/recommendations-service";
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
      userLimit: rateLimits.recommendations?.userLimit ?? 10,
      ipLimit: rateLimits.recommendations?.ipLimit ?? 20,
      windowMs: rateLimits.recommendations?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const { data, cache } = await getRecommendations(userId);
    return NextResponse.json(data, {
      headers: { "X-Cache": cache },
    });
  } catch (error) {
    console.error("Erro em GET /api/recommendations:", error);
    return NextResponse.json(
      { error: "Erro ao gerar recomendações" },
      { status: 500 }
    );
  }
}
