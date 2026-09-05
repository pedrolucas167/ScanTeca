import { isTitleSimilar, isAuthorSimilar } from "./book-cover";

interface GoogleBooksVolume {
  totalItems: number;
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
      description?: string;
    };
  }[];
}

interface OpenLibrarySearchDoc {
  title?: string;
  author_name?: string[];
  key?: string;
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

interface OpenLibraryWork {
  description?:
    | string
    | { type: string; value: string };
}

interface WikipediaExtractResponse {
  query?: {
    pages?: Record<string, { extract?: string }>;
  };
}

function cleanSynopsis(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;
  return text.length > 2500 ? `${text.slice(0, 2500).trim()}...` : text;
}

async function findOpenLibrarySynopsisByIsbn(
  isbn: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, { works?: { key: string }[] }>;
    const book = data[`ISBN:${isbn}`];
    const workKey = book?.works?.[0]?.key;
    if (!workKey) return null;

    const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
    if (!workRes.ok) return null;

    const work = (await workRes.json()) as OpenLibraryWork;
    const raw = work.description;
    const synopsis = typeof raw === "string" ? raw : raw?.value;
    return cleanSynopsis(synopsis);
  } catch (err) {
    console.error("[findSynopsis] Open Library ISBN error:", err);
    return null;
  }
}

async function findGoogleBooksSynopsisByIsbn(
  isbn: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url = apiKey
    ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=5&key=${apiKey}`
    : `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=5`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as GoogleBooksVolume;
    if (!data.items || data.totalItems === 0) return null;

    for (const item of data.items) {
      const desc = item.volumeInfo.description;
      if (desc) return cleanSynopsis(desc);
    }
  } catch (err) {
    console.error("[findSynopsis] Google Books ISBN error:", err);
  }

  return null;
}

async function findGoogleBooksSynopsisByTitleAuthor(
  title: string,
  author?: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const queryTitle = title.toLowerCase().trim();
  const queryAuthor = (author || "").toLowerCase().trim();

  const queries = [
    `intitle:${encodeURIComponent(title)}${
      author ? `+inauthor:${encodeURIComponent(author)}` : ""
    }`,
    encodeURIComponent(`${title} ${author || ""}`.trim()),
  ];

  for (const q of queries) {
    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as GoogleBooksVolume;
      if (!data.items || data.totalItems === 0) continue;

      for (const item of data.items) {
        const info = item.volumeInfo;
        if (!info.description) continue;

        const foundTitle = (info.title || "").toLowerCase();
        const foundAuthor = (info.authors?.[0] || "").toLowerCase();

        if (
          isTitleSimilar(queryTitle, foundTitle) &&
          (!queryAuthor || isAuthorSimilar(queryAuthor, foundAuthor))
        ) {
          return cleanSynopsis(info.description);
        }
      }
    } catch (err) {
      console.error("[findSynopsis] Google Books search error:", err);
    }
  }

  return null;
}

async function findOpenLibrarySynopsisByTitleAuthor(
  title: string,
  author?: string
): Promise<string | null> {
  const queryTitle = title.toLowerCase().trim();
  const queryAuthor = (author || "").toLowerCase().trim();

  const queries = [
    `${title} ${author || ""}`.trim(),
    title,
    title.replace(/[^\w\s]/g, ""),
  ];

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20`
      );
      if (!res.ok) continue;

      const data = (await res.json()) as OpenLibrarySearchResponse;
      const docs = data?.docs || [];

      for (const doc of docs) {
        if (!doc) continue;

        const foundTitle = (doc.title || "").toLowerCase();
        const foundAuthor = (doc.author_name?.[0] || "").toLowerCase();

        if (!isTitleSimilar(queryTitle, foundTitle)) continue;
        if (queryAuthor && !isAuthorSimilar(queryAuthor, foundAuthor)) continue;

        const workKey = doc.key;
        if (!workKey) continue;

        const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
        if (!workRes.ok) continue;

        const work = (await workRes.json()) as OpenLibraryWork;
        const raw = work.description;
        const synopsis = typeof raw === "string" ? raw : raw?.value;
        const cleaned = cleanSynopsis(synopsis);
        if (cleaned) return cleaned;
      }
    } catch (err) {
      console.error("[findSynopsis] Open Library search error:", err);
    }
  }

  return null;
}

async function findWikipediaSynopsis(title: string): Promise<string | null> {
  const searchTitle = title.trim();
  if (!searchTitle) return null;

  const urls = [
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      searchTitle
    )}&prop=extracts&exintro=1&explaintext=1&exsentences=6&format=json&origin=*&redirects=1`,
    `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      searchTitle
    )}&prop=extracts&exintro=1&explaintext=1&exsentences=6&format=json&origin=*&redirects=1`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as WikipediaExtractResponse;
      const pages = data?.query?.pages || {};

      for (const pageId in pages) {
        const extract = pages[pageId]?.extract;
        const cleaned = cleanSynopsis(extract);
        if (cleaned) return cleaned;
      }
    } catch (err) {
      console.error("[findSynopsis] Wikipedia error:", err);
    }
  }

  return null;
}

export async function findSynopsis({
  title,
  author,
  isbn,
}: {
  title?: string;
  author?: string;
  isbn?: string;
}): Promise<string | null> {
  const cleanedIsbn = isbn ? isbn.replace(/[^0-9X]/gi, "") : "";

  if (cleanedIsbn) {
    const olSynopsis = await findOpenLibrarySynopsisByIsbn(cleanedIsbn);
    if (olSynopsis) return olSynopsis;

    const gbSynopsis = await findGoogleBooksSynopsisByIsbn(cleanedIsbn);
    if (gbSynopsis) return gbSynopsis;
  }

  if (!title) return null;

  const gbSearchSynopsis = await findGoogleBooksSynopsisByTitleAuthor(
    title,
    author
  );
  if (gbSearchSynopsis) return gbSearchSynopsis;

  const olSearchSynopsis = await findOpenLibrarySynopsisByTitleAuthor(
    title,
    author
  );
  if (olSearchSynopsis) return olSearchSynopsis;

  const wikiSynopsis = await findWikipediaSynopsis(
    `${title} ${author || ""}`.trim()
  );
  if (wikiSynopsis) return wikiSynopsis;

  return null;
}
