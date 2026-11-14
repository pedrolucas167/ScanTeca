import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import {
  cleanTitle,
  normalizeAuthor,
  normalizeGenre,
  upgradeCoverUrl,
} from "@/lib/book-metadata";
import { cleanSynopsis } from "@/lib/synopsis";
import { z } from "zod";
import { searchGoogleBooks } from "@/lib/google-books";
import { volumeIsbn } from "@/lib/book-search-rules";

const searchBooksSchema = z.object({
  query: z
    .string("Termo de busca é obrigatório")
    .trim()
    .min(1, "Termo de busca é obrigatório"),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "search-books",
      userId,
      userLimit: rateLimits["search-books"]?.userLimit ?? 10,
      ipLimit: rateLimits["search-books"]?.ipLimit ?? 20,
      windowMs: rateLimits["search-books"]?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, searchBooksSchema);
    if (!parsed.ok) return parsed.response;
    const { query } = parsed.data;

    const items = await searchGoogleBooks(query);
    if (!items) {
      return NextResponse.json(
        { error: "Erro ao buscar no Google Books" },
        { status: 502 }
      );
    }
    const results = items.map((item) => {
      const info = item.volumeInfo;
      // A comma-separated pair is interpreted as "surname, given name" when saved.
      const authors = info.authors?.map(normalizeAuthor).filter(Boolean).join("; ");
      return {
        googleId: item.id,
        title: cleanTitle(info.title) || "",
        subtitle: cleanTitle(info.subtitle) || null,
        author: authors || "Autor desconhecido",
        publishedDate: info.publishedDate || null,
        synopsis: cleanSynopsis(info.description) || null,
        pages: info.pageCount || null,
        genre: normalizeGenre(info.categories?.[0]),
        isbn: volumeIsbn(item),
        coverUrl: upgradeCoverUrl(
          info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
        ),
      };
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    console.error("Erro em POST /api/search-books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
