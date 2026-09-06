import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { findSynopsis, cleanSynopsis } from "@/lib/synopsis";
import { findOriginalPublishYear, extractYear } from "@/lib/original-date";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";
import { isTitleSimilar, isAuthorSimilar } from "@/lib/book-cover";

interface GoogleBooksItem {
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    categories?: string[];
  };
}

interface BookRow {
  id: string;
  isbn: string | null;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  genre: string | null;
  pages: number | null;
  notes: string | null;
  rating: number | null;
}

interface EnrichResult {
  id: string;
  title: string;
  updated: string[];
  values: {
    synopsis?: string;
    genre?: string;
    pages?: number;
    publishedDate?: string;
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Busca no Google Books o melhor match para o livro e retorna
 * sinopse, gênero e páginas do mesmo volume (dados consistentes).
 */
async function fetchGoogleBooksFields(book: BookRow): Promise<{
  synopsis: string | null;
  genre: string | null;
  pages: number | null;
}> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `&key=${apiKey}` : "";

  const queries: string[] = [];
  const cleanedIsbn = book.isbn?.replace(/[^0-9X]/gi, "");
  if (cleanedIsbn) queries.push(`isbn:${cleanedIsbn}`);
  queries.push(
    `intitle:${encodeURIComponent(book.title)}+inauthor:${encodeURIComponent(book.author)}`
  );
  queries.push(encodeURIComponent(`${book.title} ${book.author}`));

  const queryTitle = book.title.toLowerCase().trim();
  const queryAuthor = book.author.toLowerCase().trim();

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10${keyParam}`
      );
      if (!res.ok) continue;

      const data = (await res.json()) as { items?: GoogleBooksItem[] };
      if (!data.items?.length) continue;

      for (const item of data.items) {
        const info = item.volumeInfo;
        const foundTitle = (info.title || "").toLowerCase();
        const foundAuthor = (info.authors?.[0] || "").toLowerCase();

        // ISBN query returns exact matches; title/author queries need validation
        const isIsbnQuery = q.startsWith("isbn:");
        if (
          !isIsbnQuery &&
          (!isTitleSimilar(queryTitle, foundTitle) ||
            (queryAuthor && !isAuthorSimilar(queryAuthor, foundAuthor)))
        ) {
          continue;
        }

        return {
          synopsis: cleanSynopsis(info.description),
          genre: info.categories?.[0] || null,
          pages: info.pageCount || null,
        };
      }
    } catch (err) {
      console.error("[enrich] Google Books error:", err);
    }
  }

  return { synopsis: null, genre: null, pages: null };
}

/**
 * POST /api/books/enrich
 * Preenche campos vazios (sinopse, gênero, páginas) dos livros do usuário.
 * Body opcional: { bookId } para enriquecer um único livro.
 * Nunca sobrescreve campos já preenchidos. Regenera o embedding
 * quando sinopse ou gênero mudam (mantém o RAG atualizado).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      bookId?: string;
    };
    const bookId = typeof body.bookId === "string" ? body.bookId : null;

    const books = bookId
      ? await prisma.$queryRaw<BookRow[]>`
          SELECT id, isbn, title, author, "publishedDate", synopsis, genre, pages, notes, rating
          FROM "Book"
          WHERE id = ${bookId} AND "userId" = ${userId}
        `
      : await prisma.$queryRaw<BookRow[]>`
          SELECT id, isbn, title, author, "publishedDate", synopsis, genre, pages, notes, rating
          FROM "Book"
          WHERE "userId" = ${userId}
            AND (
              synopsis IS NULL OR btrim(synopsis) = ''
              OR genre IS NULL OR pages IS NULL
            )
          ORDER BY title
        `;

    if (bookId && books.length === 0) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    const results: EnrichResult[] = [];

    for (const book of books) {
      const updates: {
        synopsis?: string;
        genre?: string;
        pages?: number;
        publishedDate?: string;
      } = {};
      const needsSynopsis = !book.synopsis?.trim();
      const needsGenre = !book.genre;
      const needsPages = !book.pages;

      if (needsSynopsis || needsGenre || needsPages) {
        const gb = await fetchGoogleBooksFields(book);
        if (needsGenre && gb.genre) updates.genre = gb.genre;
        if (needsPages && gb.pages) updates.pages = gb.pages;
        if (needsSynopsis && gb.synopsis) updates.synopsis = gb.synopsis;
      }

      // Fallback multi-fonte para sinopse (Open Library, Wikipedia)
      if (needsSynopsis && !updates.synopsis) {
        const syn = await findSynopsis({
          title: book.title,
          author: book.author,
          isbn: book.isbn ?? undefined,
        });
        if (syn) updates.synopsis = syn;
      }

      // Corrige data de reimpressão → primeira publicação da obra
      const originalYear = await findOriginalPublishYear({
        title: book.title,
        author: book.author,
        isbn: book.isbn ?? undefined,
      });
      if (originalYear) {
        const currentYear = extractYear(book.publishedDate);
        if (!currentYear || originalYear < currentYear) {
          updates.publishedDate = String(originalYear);
        }
      }

      const updatedFields = Object.keys(updates);
      if (updatedFields.length > 0) {
        await prisma.book.update({ where: { id: book.id }, data: updates });

        // Regenera embedding quando o conteúdo semântico muda
        if (updates.synopsis || updates.genre) {
          const merged = { ...book, ...updates };
          const embedding = await generateEmbedding(
            bookToEmbeddingText(merged)
          );
          if (embedding) {
            const vector = `[${embedding.join(",")}]`;
            await prisma.$executeRaw`
              UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id}
            `;
          }
        }
      }

      results.push({
        id: book.id,
        title: book.title,
        updated: updatedFields,
        values: updates,
      });

      // Rate limit entre livros (Google Books + OpenRouter)
      if (!bookId) await sleep(400);
    }

    const enriched = results.filter((r) => r.updated.length > 0);

    return NextResponse.json({
      total: books.length,
      enriched: enriched.length,
      results,
    });
  } catch (error) {
    console.error("Erro em POST /api/books/enrich:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
