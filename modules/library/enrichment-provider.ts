import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cleanSynopsis } from "@/lib/synopsis";
import { cleanIsbn, extractMainTitle, normalizeAuthor, normalizeGenre, isTitleSimilar, isAuthorSimilar } from "@/lib/book-metadata";
interface GoogleBooksItem {
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    categories?: string[];
  };
}

export interface BookRow {
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

export interface EnrichResult {
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

/**
 * Busca no Google Books o melhor match para o livro e retorna
 * sinopse, gênero e páginas do mesmo volume (dados consistentes).
 */
export async function fetchGoogleBooksFields(book: BookRow): Promise<{
  synopsis: string | null;
  genre: string | null;
  pages: number | null;
}> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const keyParam = apiKey ? `&key=${apiKey}` : "";

  const queries: string[] = [];
  const cleanedIsbn = cleanIsbn(book.isbn);
  const mainTitle = extractMainTitle(book.title) || book.title;
  const normalAuthor = normalizeAuthor(book.author) || book.author;

  if (cleanedIsbn) queries.push(`isbn:${cleanedIsbn}`);
  queries.push(
    `intitle:${encodeURIComponent(mainTitle)}+inauthor:${encodeURIComponent(normalAuthor)}`
  );
  queries.push(encodeURIComponent(`${mainTitle} ${normalAuthor}`));

  const queryTitle = mainTitle.toLowerCase().trim();
  const queryAuthor = normalAuthor.toLowerCase().trim();

  for (const q of queries) {
    try {
      const res = await fetchWithTimeout(
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
          genre: normalizeGenre(info.categories?.[0]),
          pages: info.pageCount || null,
        };
      }
    } catch (err) {
      console.error("[enrich] Google Books error:", err);
    }
  }

  return { synopsis: null, genre: null, pages: null };
}

