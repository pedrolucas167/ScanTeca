import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

interface GoogleBooksItem {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Termo de busca é obrigatório" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const q = encodeURIComponent(query.trim());
    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20&langRestrict=pt&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20&langRestrict=pt`;

    const res = await fetchWithRetry(url, {
      maxRetries: 3,
      baseDelay: 500,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Erro ao buscar no Google Books" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const items = (data.items || []) as GoogleBooksItem[];

    const results = items
      .map((item) => {
        const info = item.volumeInfo;
        const isbn13 = info.industryIdentifiers?.find(
          (i) => i.type === "ISBN_13"
        )?.identifier;
        const isbn10 = info.industryIdentifiers?.find(
          (i) => i.type === "ISBN_10"
        )?.identifier;

        return {
          googleId: item.id,
          title: info.title || "",
          subtitle: info.subtitle || null,
          author: info.authors?.join(", ") || "Autor desconhecido",
          publishedDate: info.publishedDate || null,
          synopsis: info.description || null,
          pages: info.pageCount || null,
          genre: info.categories?.[0] || null,
          isbn: isbn13 || isbn10 || null,
          coverUrl:
            info.imageLinks?.thumbnail?.replace("http://", "https://") ||
            info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
            null,
        };
      })
      .filter((r) => r.title);

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Erro em POST /api/search-books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
