import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findSynopsis } from "@/lib/synopsis";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = (await request.json()) || {};
    const { title, author, isbn, currentSynopsis, force } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Título é obrigatório" },
        { status: 400 }
      );
    }

    const hasCurrentSynopsis =
      typeof currentSynopsis === "string" && currentSynopsis.trim().length > 0;

    if (!force && hasCurrentSynopsis) {
      return NextResponse.json({ synopsis: currentSynopsis.trim() });
    }

    const synopsis = await findSynopsis({
      title: title.trim(),
      author: typeof author === "string" ? author.trim() : undefined,
      isbn: typeof isbn === "string" ? isbn.trim() : undefined,
    });

    return NextResponse.json({ synopsis });
  } catch (error) {
    console.error("Erro em POST /api/generate-synopsis:", error);
    return NextResponse.json(
      { error: "Erro ao gerar sinopse" },
      { status: 500 }
    );
  }
}
