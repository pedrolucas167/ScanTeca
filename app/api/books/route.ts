import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { isbn, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating } = body;

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
        status: (status as BookStatus) || BookStatus.TO_READ,
        collection: collection || "Minha Biblioteca",
        notes: notes || null,
        rating: rating ?? null,
        userId,
      },
    });

    return NextResponse.json(
      { book, message: "Livro adicionado com sucesso" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro em POST /api/books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "ID do livro é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await prisma.book.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (author !== undefined) data.author = author || "Autor desconhecido";
    if (publishedDate !== undefined) data.publishedDate = publishedDate || null;
    if (synopsis !== undefined) data.synopsis = synopsis || null;
    if (coverUrl !== undefined) data.coverUrl = coverUrl || null;
    if (status !== undefined) data.status = status as BookStatus;
    if (collection !== undefined) data.collection = collection || "Minha Biblioteca";
    if (notes !== undefined) data.notes = notes || null;
    if (rating !== undefined) data.rating = rating ?? null;

    const book = await prisma.book.update({
      where: { id },
      data,
    });

    return NextResponse.json(
      { book, message: "Livro atualizado com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro em PATCH /api/books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
