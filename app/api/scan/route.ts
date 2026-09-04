import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface GoogleBooksVolume {
  totalItems: number;
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
      publishedDate?: string;
      description?: string;
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { isbn } = body as { isbn: string };

    if (!isbn || typeof isbn !== "string") {
      return NextResponse.json(
        { error: "ISBN é obrigatório" },
        { status: 400 }
      );
    }

    const cleaned = isbn.replace(/[^0-9X]/gi, "");

    const existing = await prisma.book.findUnique({
      where: { isbn: cleaned },
    });

    if (existing) {
      return NextResponse.json(
        { book: existing, message: "Livro já cadastrado" },
        { status: 200 }
      );
    }

    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Falha ao consultar Google Books API" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as GoogleBooksVolume;

    if (!data.items || data.totalItems === 0) {
      return NextResponse.json(
        { error: "Nenhum livro encontrado para este ISBN" },
        { status: 404 }
      );
    }

    const info = data.items[0].volumeInfo;

    const book = await prisma.book.create({
      data: {
        isbn: cleaned,
        title: info.title ?? "Título desconhecido",
        author: info.authors?.join(", ") ?? "Autor desconhecido",
        publishedDate: info.publishedDate ?? null,
        synopsis: info.description ?? null,
        coverUrl: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
      },
    });

    return NextResponse.json({ book, message: "Livro adicionado com sucesso" }, { status: 201 });
  } catch (error) {
    console.error("Erro em /api/scan:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
