import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { isbn, title, author, publishedDate, synopsis, coverUrl } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Título é obrigatório" },
        { status: 400 }
      );
    }

    const cleanedIsbn = isbn ? isbn.replace(/[^0-9X]/gi, "") : null;

    if (cleanedIsbn && cleanedIsbn.length !== 10 && cleanedIsbn.length !== 13) {
      return NextResponse.json(
        { error: "ISBN deve ter 10 ou 13 dígitos" },
        { status: 400 }
      );
    }

    const existing = cleanedIsbn
      ? await prisma.book.findUnique({
          where: {
            isbn_userId: {
              isbn: cleanedIsbn,
              userId,
            },
          },
        })
      : null;

    if (existing) {
      return NextResponse.json(
        { book: existing, message: "Livro já cadastrado" },
        { status: 200 }
      );
    }

    const book = await prisma.book.create({
      data: {
        isbn: cleanedIsbn || "MANUAL",
        title,
        author: author || "Autor desconhecido",
        publishedDate: publishedDate || null,
        synopsis: synopsis || null,
        coverUrl: coverUrl || null,
        userId,
      },
    });

    return NextResponse.json(
      { book, message: "Livro adicionado com sucesso" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro em /api/books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
