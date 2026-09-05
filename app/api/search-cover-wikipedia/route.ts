import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findWikipediaCover } from "@/lib/book-cover";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title } = body as { title?: string };

    if (!title) {
      return NextResponse.json(
        { error: "Título é obrigatório" },
        { status: 400 }
      );
    }

    const coverUrl = await findWikipediaCover(title);

    if (!coverUrl) {
      return NextResponse.json(
        { error: "Nenhuma capa encontrada na Wikipédia" },
        { status: 404 }
      );
    }

    return NextResponse.json({ coverUrl });
  } catch (error) {
    console.error("Erro em /api/search-cover-wikipedia:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
