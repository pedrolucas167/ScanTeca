import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildRecommendations } from "@/lib/recommendations";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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
