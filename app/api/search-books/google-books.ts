import { cleanIsbn, cleanTitle, normalizeAuthor } from "@/lib/book-metadata";
import { fetchWithRetry } from "@/lib/fetch-with-retry";

interface GoogleBooksItem {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    language?: string;
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

const maxResults = 20;
const strongFieldMatch = 5;

function searchText(text: string): string {
  return text.normalize("NFD").toLowerCase().replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function splitTitleAndAuthor(query: string) {
  // Work from the last separator so a title can itself contain a comma.
  const separator = [...query.matchAll(/,|[–—]|\s+-\s+/g)].at(-1);
  if (!separator) return null;
  const title = query.slice(0, separator.index).trim();
  const author = query.slice(separator.index + separator[0].length).trim();
  return searchText(title) && searchText(author) ? { title, author } : null;
}

function matchQuality(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 2;
  return ` ${candidate} `.includes(` ${query} `) ? 1 : 0;
}

function bookRelevance(query: string, parts: ReturnType<typeof splitTitleAndAuthor>) {
  const wholeQuery = searchText(query);
  const wholeAuthor = parts ? searchText(normalizeAuthor(query) ?? "") : wholeQuery;
  const titleQuery = parts ? searchText(parts.title) : "";
  const authorQuery = parts ? searchText(parts.author) : "";

  return ({ volumeInfo }: GoogleBooksItem): number => {
    const title = searchText(volumeInfo.title ?? "");
    const fullTitle = searchText(`${volumeInfo.title ?? ""} ${volumeInfo.subtitle ?? ""}`);
    const authors = (volumeInfo.authors ?? []).flatMap((author) => [
      searchText(author),
      searchText(normalizeAuthor(author) ?? ""),
    ]);
    const titleMatch = (text: string) =>
      Math.max(matchQuality(text, title), matchQuality(text, fullTitle));
    const authorMatch = (text: string) =>
      Math.max(0, ...authors.map((author) => matchQuality(text, author)));

    const titleQuality = titleMatch(titleQuery);
    const authorQuality = authorMatch(authorQuery);
    // An exact whole query outranks a split with only partial matches.
    const fieldScore = titleQuality && authorQuality ? 2 * (titleQuality + authorQuality) - 1 : 0;
    const wholeScore = 2 * Math.max(
      titleMatch(wholeQuery),
      authorMatch(wholeQuery),
      authorMatch(wholeAuthor)
    );
    return Math.max(fieldScore, wholeScore);
  };
}

function isbn13CheckDigit(body: string): number {
  const sum = [...body].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0
  );
  return (10 - (sum % 10)) % 10;
}

function canonicalIsbn(isbn: string): string | null {
  if (/^97[89]\d{10}$/.test(isbn)) {
    return isbn13CheckDigit(isbn.slice(0, 12)) === Number(isbn[12]) ? isbn : null;
  }
  if (!/^\d{9}[\dX]$/.test(isbn)) return null;
  const sum = [...isbn].reduce(
    (total, digit, index) => total + (digit === "X" ? 10 : Number(digit)) * (10 - index),
    0
  );
  if (sum % 11 !== 0) return null;
  const body = `978${isbn.slice(0, 9)}`;
  return `${body}${isbn13CheckDigit(body)}`;
}

function volumeIsbns(item: GoogleBooksItem): string[] {
  const ids = item.volumeInfo.industryIdentifiers ?? [];
  return ["ISBN_13", "ISBN_10"]
    .flatMap((type) => ids.filter((id) => id.type === type))
    .map((id) => cleanIsbn(id.identifier))
    .filter((isbn) => isbn !== null);
}

export function volumeIsbn(item: GoogleBooksItem): string | null {
  return volumeIsbns(item)[0] ?? null;
}

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

function uniqueVolumes(items: GoogleBooksItem[]): GoogleBooksItem[] {
  const ids = new Set<string>();
  const isbns = new Set<string>();
  return items.filter((item) => {
    const isbn = volumeIsbn(item);
    const key = isbn && (canonicalIsbn(isbn) ?? isbn);
    if (ids.has(item.id) || (key && isbns.has(key))) return false;
    ids.add(item.id);
    if (key) isbns.add(key);
    return true;
  }).slice(0, maxResults);
}

function quoteField(text: string): string {
  return `"${text.replace(/["“”]/g, "").replace(/\\/g, " ")}"`;
}

export async function searchGoogleBooks(query: string): Promise<GoogleBooksItem[] | null> {
  const isbnInput = query.replace(/^ISBN(?:-1[03])?\s*:?\s*/i, "");
  const isbn = /^[\dX\s-]+$/i.test(isbnInput) ? cleanIsbn(isbnInput) : null;
  const exactIsbn = isbn && canonicalIsbn(isbn);
  if (isbn && exactIsbn) {
    const matchesEdition = (item: GoogleBooksItem) =>
      volumeIsbns(item).some((id) => canonicalIsbn(id) === exactIsbn);
    const exact = (await fetchVolumes(`isbn:${isbn}`))?.filter(matchesEdition);
    if (exact?.length) return uniqueVolumes(exact);
    const fallback = await fetchVolumes(isbn);
    return fallback && uniqueVolumes(fallback.filter(matchesEdition));
  }

  const parts = splitTitleAndAuthor(query);
  const relevance = bookRelevance(query, parts);
  let items: GoogleBooksItem[] | null;
  if (parts) {
    const fields = `intitle:${quoteField(parts.title)} inauthor:${quoteField(parts.author)}`;
    items = await fetchVolumes(fields);
    // If both fields don't match well, the separator may be part of a title or name.
    if (!items?.some((item) => relevance(item) >= strongFieldMatch)) {
      const fallback = await fetchVolumes(query);
      if (fallback) items = [...fallback, ...(items ?? [])];
      else if (!items?.length) return null;
    }
  } else {
    items = await fetchVolumes(query);
  }

  if (!items) return null;
  const ranked = items.map((item) => ({
    item,
    quality: relevance(item),
    portuguese: Number(item.volumeInfo.language === "pt"),
  }));
  ranked.sort((a, b) => b.quality - a.quality || b.portuguese - a.portuguese);
  return uniqueVolumes(ranked.map(({ item }) => item));
}
