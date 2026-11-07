import { cleanTitle } from "@/lib/book-metadata";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import {
  bookRelevance,
  hasStrongFieldMatch,
  matchesEdition,
  parseSearchIsbn,
  rankVolumes,
  splitTitleAndAuthor,
  uniqueVolumes,
  type SearchVolume,
} from "./search-rules";

interface GoogleBooksItem extends SearchVolume {
  volumeInfo: SearchVolume["volumeInfo"] & {
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}

const maxResults = 20;

async function fetchVolumes(query: string): Promise<GoogleBooksItem[] | null> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) url.searchParams.set("key", key);

  const response = await fetchWithRetry(url.toString(), { maxRetries: 3, baseDelay: 500 });
  if (!response.ok) return null;
  const data: { items?: GoogleBooksItem[] } = await response.json();
  return (data.items ?? []).filter((item) => cleanTitle(item.volumeInfo.title));
}

function quoteField(text: string): string {
  return `"${text.replace(/["“”]/g, "").replace(/\\/g, " ")}"`;
}

async function searchByIsbn(isbn: string, exactIsbn: string): Promise<GoogleBooksItem[] | null> {
  const exact = (await fetchVolumes(`isbn:${isbn}`))?.filter((item) => matchesEdition(item, exactIsbn));
  if (exact?.length) return exact;
  const fallback = await fetchVolumes(isbn);
  return fallback && fallback.filter((item) => matchesEdition(item, exactIsbn));
}

async function searchByText(query: string): Promise<GoogleBooksItem[] | null> {
  const parts = splitTitleAndAuthor(query);
  const relevance = bookRelevance(query, parts);
  let items: GoogleBooksItem[] | null;
  if (parts) {
    const fields = `intitle:${quoteField(parts.title)} inauthor:${quoteField(parts.author)}`;
    items = await fetchVolumes(fields);
    // If both fields don't match well, the separator may be part of a title or name.
    if (!hasStrongFieldMatch(items ?? [], relevance)) {
      const fallback = await fetchVolumes(query);
      if (fallback) items = [...fallback, ...(items ?? [])];
      else if (!items?.length) return null;
    }
  } else {
    items = await fetchVolumes(query);
  }

  return items && rankVolumes(items, relevance);
}

export async function searchGoogleBooks(query: string): Promise<GoogleBooksItem[] | null> {
  const isbnQuery = parseSearchIsbn(query);
  const items = isbnQuery
    ? await searchByIsbn(isbnQuery.isbn, isbnQuery.exactIsbn)
    : await searchByText(query);
  return items && uniqueVolumes(items).slice(0, maxResults);
}
