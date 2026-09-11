import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import {
  cleanTitle,
  normalizeAuthor,
  normalizeGenre,
  upgradeCoverUrl,
  cleanIsbn,
} from "@/lib/book-metadata";
import { cleanSynopsis } from "@/lib/synopsis";
import { z } from "zod";

const searchBooksSchema = z.object({
  query: z
    .string("Termo de busca é obrigatório")
    .trim()
    .min(1, "Termo de busca é obrigatório"),
});

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

    const rateLimit = await rateLimitGuard(request, {
      route: "search-books",
      userId,
      ...rateLimits["search-books"],
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, searchBooksSchema);
    if (!parsed.ok) return parsed.response;
    const { query } = parsed.data;

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const q = encodeURIComponent(query);

    // Tenta primeiro resultados em português; se não achar, busca em qualquer idioma.
    const makeUrl = (lang: string) =>
      apiKey
        ? `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20${lang}&key=${apiKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20${lang}`;

    const ptRes = await fetchWithRetry(makeUrl("&langRestrict=pt"), {
      maxRetries: 3,
      baseDelay: 500,
    });

    let data: { items?: GoogleBooksItem[] } = {};

    if (ptRes.ok) {
      data = await ptRes.json();
      if (!data.items || data.items.length === 0) {
        const fallbackRes = await fetchWithRetry(makeUrl(""), {
          maxRetries: 3,
          baseDelay: 500,
        });
        if (fallbackRes.ok) {
          data = await fallbackRes.json();
        } else {
          return NextResponse.json(
            { error: "Erro ao buscar no Google Books" },
            { status: 502 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: "Erro ao buscar no Google Books" },
        { status: 502 }
      );
    }
    const rawItems = (data.items || []) as GoogleBooksItem[];

    // Remove duplicatas pelo ISBN para evitar várias edições idênticas na lista.
    const seen = new Set<string>();
    const items = rawItems.filter((item) => {
      const info = item.volumeInfo;
      const isbn13 = info.industryIdentifiers?.find(
        (i) => i.type === "ISBN_13"
      )?.identifier;
      const isbn10 = info.industryIdentifiers?.find(
        (i) => i.type === "ISBN_10"
      )?.identifier;
      const key = cleanIsbn(isbn13 || isbn10 || "") || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const results = items
      .map((item) => {
        const info = item.volumeInfo;
        const isbn13 = info.industryIdentifiers?.find(
          (i) => i.type === "ISBN_13"
        )?.identifier;
        const isbn10 = info.industryIdentifiers?.find(
          (i) => i.type === "ISBN_10"
        )?.identifier;
        const isbn = cleanIsbn(isbn13 || isbn10 || "") || null;

        return {
          googleId: item.id,
          title: cleanTitle(info.title) || "",
          subtitle: cleanTitle(info.subtitle) || null,
          author: normalizeAuthor(info.authors?.join(", ")) ?? "Autor desconhecido",
          publishedDate: info.publishedDate || null,
          synopsis: cleanSynopsis(info.description) || null,
          pages: info.pageCount || null,
          genre: normalizeGenre(info.categories?.[0]),
          isbn,
          coverUrl: upgradeCoverUrl(
            info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
          ),
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
