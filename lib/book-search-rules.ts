import { cleanIsbn, normalizeAuthor } from "./book-metadata";

export interface SearchVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

const strongFieldMatch = 5;

function searchText(text: string): string {
  return text.normalize("NFD").toLowerCase().replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function splitTitleAndAuthor(query: string) {
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

export function bookRelevance(query: string, parts: ReturnType<typeof splitTitleAndAuthor>) {
  const wholeQuery = searchText(query);
  const wholeAuthor = parts ? searchText(normalizeAuthor(query) ?? "") : wholeQuery;
  const titleQuery = parts ? searchText(parts.title) : "";
  const authorQuery = parts ? searchText(parts.author) : "";

  return ({ volumeInfo }: SearchVolume): number => {
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

export function parseSearchIsbn(query: string) {
  const isbnInput = query.replace(/^ISBN(?:-1[03])?\s*:?\s*/i, "");
  const isbn = /^[\dX\s-]+$/i.test(isbnInput) ? cleanIsbn(isbnInput) : null;
  const exactIsbn = isbn && canonicalIsbn(isbn);
  return isbn && exactIsbn ? { isbn, exactIsbn } : null;
}

function volumeIsbns(item: SearchVolume): string[] {
  const ids = item.volumeInfo.industryIdentifiers ?? [];
  return ["ISBN_13", "ISBN_10"]
    .flatMap((type) => ids.filter((id) => id.type === type))
    .map((id) => cleanIsbn(id.identifier))
    .filter((isbn) => isbn !== null);
}

export function volumeIsbn(item: SearchVolume): string | null {
  return volumeIsbns(item)[0] ?? null;
}

export function matchesEdition(item: SearchVolume, exactIsbn: string): boolean {
  return volumeIsbns(item).some((isbn) => canonicalIsbn(isbn) === exactIsbn);
}

export function hasStrongFieldMatch(items: SearchVolume[], relevance: (item: SearchVolume) => number): boolean {
  return items.some((item) => relevance(item) >= strongFieldMatch);
}

export function rankVolumes<T extends SearchVolume>(items: T[], relevance: (item: SearchVolume) => number): T[] {
  const ranked = items.map((item) => ({
    item,
    quality: relevance(item),
    portuguese: Number(item.volumeInfo.language === "pt"),
  }));
  ranked.sort((a, b) => b.quality - a.quality || b.portuguese - a.portuguese);
  return ranked.map(({ item }) => item);
}

export function uniqueVolumes<T extends SearchVolume>(items: T[]): T[] {
  const ids = new Set<string>();
  const isbns = new Set<string>();
  return items.filter((item) => {
    const isbn = volumeIsbn(item);
    const key = isbn && (canonicalIsbn(isbn) ?? isbn);
    if (ids.has(item.id) || (key && isbns.has(key))) return false;
    ids.add(item.id);
    if (key) isbns.add(key);
    return true;
  });
}
