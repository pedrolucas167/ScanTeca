import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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

interface OpenLibraryBook {
  title?: string;
  authors?: { name: string }[];
  publish_date?: string;
  cover?: { medium?: string; small?: string };
}

interface OpenLibraryResponse {
  [key: string]: OpenLibraryBook;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isbn } = body as { isbn: string };

    if (!isbn || typeof isbn !== "string") {
      return NextResponse.json(
        { error: "ISBN é obrigatório" },
        { status: 400 }
      );
    }

    const cleaned = isbn.replace(/[^0-9X]/gi, "");

    // Validate ISBN length (10 or 13 digits)
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      return NextResponse.json(
        { error: `ISBN inválido: ${cleaned} (deve ter 10 ou 13 dígitos)` },
        { status: 400 }
      );
    }

    const existing = await prisma.book.findUnique({
      where: {
        isbn_userId: {
          isbn: cleaned,
          userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { book: existing, message: "Livro já cadastrado" },
        { status: 200 }
      );
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const googleUrl = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}`;

    let bookData: {
      title: string;
      author: string;
      publishedDate: string | null;
      synopsis: string | null;
      coverUrl: string | null;
    } | null = null;

    // Try Open Library first (more reliable for ISBN lookups)
    try {
      const olRes = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`
      );
      if (olRes.ok) {
        const olData = (await olRes.json()) as OpenLibraryResponse;
        const key = `ISBN:${cleaned}`;
        const olBook = olData[key];
        if (olBook) {
          bookData = {
            title: olBook.title ?? "Título desconhecido",
            author: olBook.authors?.map((a) => a.name).join(", ") ?? "Autor desconhecido",
            publishedDate: olBook.publish_date ?? null,
            synopsis: null,
            coverUrl: olBook.cover?.medium ?? olBook.cover?.small ?? null,
          };
        }
      }
    } catch (err) {
      console.error("Open Library API error:", err);
    }

    // Fallback to Google Books if Open Library returned nothing
    if (!bookData) {
      try {
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            bookData = {
              title: info.title ?? "Título desconhecido",
              author: info.authors?.join(", ") ?? "Autor desconhecido",
              publishedDate: info.publishedDate ?? null,
              synopsis: info.description ?? null,
              coverUrl: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
            };
          }
        } else {
          console.error(`Google Books API: status=${res.status}`);
        }
      } catch (err) {
        console.error("Google Books API error:", err);
      }
    }

    if (!bookData) {
      return NextResponse.json(
        { error: "Nenhum livro encontrado para este ISBN" },
        { status: 404 }
      );
    }

    const book = await prisma.book.create({
      data: {
        isbn: cleaned,
        title: bookData.title,
        author: bookData.author,
        publishedDate: bookData.publishedDate,
        synopsis: bookData.synopsis,
        coverUrl: bookData.coverUrl,
        userId,
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
