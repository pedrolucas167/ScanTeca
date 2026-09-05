interface GoogleBooksVolume {
  totalItems: number;
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }[];
}

interface OpenLibraryBook {
  cover?: { medium?: string; small?: string };
  works?: { key: string }[];
}

interface OpenLibraryResponse {
  [key: string]: OpenLibraryBook;
}

interface OpenLibrarySearchDoc {
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  cover?: { medium?: string; small?: string };
}

interface WikipediaPage {
  thumbnail?: {
    source?: string;
  };
}

interface WikipediaApiResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
}

export async function findBookCover({
  title,
  author,
  isbn,
}: {
  title?: string;
  author?: string;
  isbn?: string;
}): Promise<string | null> {
  const cleanedIsbn = isbn ? isbn.replace(/[^0-9X]/gi, "") : "";
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  console.log("[findBookCover] title:", title, "author:", author, "isbn:", cleanedIsbn);

  // 1. Try by ISBN (Google Books) - check multiple results
  if (cleanedIsbn) {
    try {
      const url = apiKey
        ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&maxResults=10&key=${apiKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&maxResults=10`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as GoogleBooksVolume;
        if (data.items && data.totalItems > 0) {
          for (const item of data.items) {
            const img =
              item.volumeInfo.imageLinks?.thumbnail ??
              item.volumeInfo.imageLinks?.smallThumbnail;
            if (img) {
              console.log("[findBookCover] cover found via Google Books ISBN");
              return img;
            }
          }
        }
      }
    } catch (err) {
      console.error("Google Books cover search error:", err);
    }

    // 2. Try by ISBN (Open Library)
    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanedIsbn}&format=json&jscmd=data`
      );
      if (res.ok) {
        const data = (await res.json()) as OpenLibraryResponse;
        const book = data[`ISBN:${cleanedIsbn}`];
        const cover = book?.cover?.medium ?? book?.cover?.small;
        if (cover) {
          console.log("[findBookCover] cover found via Open Library ISBN");
          return cover;
        }
      }
    } catch (err) {
      console.error("Open Library cover search error:", err);
    }
  }

  if (!title) {
    console.log("[findBookCover] no title, giving up");
    return null;
  }

  const queryTitle = title.toLowerCase().trim();
  const queryAuthor = (author || "").toLowerCase().trim();

  // 3. Try by title + author (Google Books) - check multiple results
  try {
    const q = encodeParams(title, author || "");
    const url = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as GoogleBooksVolume;
      if (data.items && data.totalItems > 0) {
        for (const item of data.items) {
          const info = item.volumeInfo;
          const img =
            info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
          if (!img) continue;

          const foundTitle = (info.title || "").toLowerCase();
          const foundAuthor = (info.authors?.[0] || "").toLowerCase();

          if (
            isTitleSimilar(queryTitle, foundTitle) &&
            (!queryAuthor || isAuthorSimilar(queryAuthor, foundAuthor))
          ) {
            console.log("[findBookCover] cover found via Google Books title/author");
            return img;
          }
        }
      }
    }
  } catch (err) {
    console.error("Google Books title search error:", err);
  }

  // 4. Try by title (Open Library search) - check multiple results
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(`${title} ${author || ""}`.trim())}&limit=20`
    );
    if (res.ok) {
      const data = await res.json();
      const docs = (data?.docs || []) as OpenLibrarySearchDoc[];
      for (const doc of docs) {
        if (!doc) continue;

        const foundTitle = (doc.title || "").toLowerCase();
        const foundAuthor = (doc.author_name?.[0] || "").toLowerCase();

        // Prefer exact title matches for popular books
        const titleMatch = isTitleSimilar(queryTitle, foundTitle);
        const authorMatch = !queryAuthor || isAuthorSimilar(queryAuthor, foundAuthor);

        if (!titleMatch) continue;

        // Try cover_i first (best source for Open Library covers)
        if (doc.cover_i) {
          const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          try {
            const headRes = await fetch(coverUrl, { method: "HEAD" });
            if (headRes.ok) {
              console.log("[findBookCover] cover found via Open Library cover_i");
              return coverUrl;
            }
          } catch {
            // ignore, try next
          }
        }

        // Try cover from API
        if (doc.cover) {
          const cover = doc.cover?.medium ?? doc.cover?.small;
          if (cover) {
            console.log("[findBookCover] cover found via Open Library search doc");
            return cover;
          }
        }

        // Try ISBNs
        const isbns: string[] = doc?.isbn || [];
        if (isbns.length > 0 && authorMatch) {
          for (const olIsbn of isbns.slice(0, 3)) {
            const olRes = await fetch(
              `https://openlibrary.org/api/books?bibkeys=ISBN:${olIsbn}&format=json&jscmd=data`
            );
            if (olRes.ok) {
              const olData = (await olRes.json()) as OpenLibraryResponse;
              const book = olData[`ISBN:${olIsbn}`];

              if (book?.works?.[0]?.key) {
                const workRes = await fetch(
                  `https://openlibrary.org${book.works[0].key}.json`
                );
                if (workRes.ok) {
                  const work = await workRes.json();
                  if (work.covers?.[0]) {
                    const coverUrl = `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`;
                    console.log("[findBookCover] cover found via Open Library work covers");
                    return coverUrl;
                  }
                }
              }

              const cover = book?.cover?.medium ?? book?.cover?.small;
              if (cover) {
                console.log("[findBookCover] cover found via Open Library title search");
                return cover;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Open Library search error:", err);
  }

  // 5. Try Wikipedia / Wikimedia for popular books (last resort)
  const wikiCover = await findWikipediaCover(title);
  if (wikiCover) {
    console.log("[findBookCover] cover found via Wikipedia");
    return wikiCover;
  }

  console.log("[findBookCover] no cover found");
  return null;
}

export async function findWikipediaCover(
  title?: string
): Promise<string | null> {
  if (!title) return null;

  try {
    const searchTitle = title.trim();
    const wikiRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTitle)}&prop=pageimages&format=json&origin=*&pithumbsize=500&redirects=1`
    );
    if (wikiRes.ok) {
      const wikiData = (await wikiRes.json()) as WikipediaApiResponse;
      const pages = wikiData?.query?.pages || {};
      for (const pageId in pages) {
        const thumb = pages[pageId]?.thumbnail?.source;
        if (thumb) return thumb;
      }
    }

    // Try Portuguese Wikipedia too
    const ptWikiRes = await fetch(
      `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTitle)}&prop=pageimages&format=json&origin=*&pithumbsize=500&redirects=1`
    );
    if (ptWikiRes.ok) {
      const ptWikiData = (await ptWikiRes.json()) as WikipediaApiResponse;
      const pages = ptWikiData?.query?.pages || {};
      for (const pageId in pages) {
        const thumb = pages[pageId]?.thumbnail?.source;
        if (thumb) return thumb;
      }
    }
  } catch (err) {
    console.error("Wikipedia search error:", err);
  }

  return null;
}

function encodeParams(title: string, author: string) {
  const parts: string[] = [];
  if (title) parts.push(`intitle:${title}`);
  if (author) parts.push(`inauthor:${author}`);
  return parts.join("+");
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áàâãéêíóôõúç\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function isTitleSimilar(query: string, found: string): boolean {
  const queryWords = normalize(query);
  const foundWords = normalize(found);
  if (queryWords.length === 0 || foundWords.length === 0) return false;

  const common = queryWords.filter((w) =>
    foundWords.some((fw) => fw === w || fw.startsWith(w) || w.startsWith(fw))
  );

  // Match if most query words appear in found title
  return common.length >= Math.max(1, Math.ceil(queryWords.length * 0.5));
}

function isAuthorSimilar(query: string, found: string): boolean {
  const queryWords = normalize(query);
  const foundWords = normalize(found);
  if (queryWords.length === 0 || foundWords.length === 0) return true;
  return queryWords.some((w) =>
    foundWords.some((fw) => fw === w || fw.includes(w) || w.includes(fw))
  );
}
