import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findBookCover } from "@/lib/book-cover";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, author, isbn } = body as {
      title?: string;
      author?: string;
      isbn?: string;
    };

    if (!title && !isbn) {
      return NextResponse.json(
        { error: "Título ou ISBN é obrigatório" },
        { status: 400 }
      );
    }

    const coverUrl = await findBookCover({ title, author, isbn });

    if (!coverUrl) {
      return NextResponse.json(
        { error: "Nenhuma capa encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ coverUrl });
  } catch (error) {
    console.error("Erro em /api/search-cover:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
