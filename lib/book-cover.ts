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
}

interface OpenLibraryResponse {
  [key: string]: OpenLibraryBook;
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
  let coverUrl: string | null = null;

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  // 1. Try by ISBN (Google Books)
  if (cleanedIsbn) {
    try {
      const url = apiKey
        ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&key=${apiKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as GoogleBooksVolume;
        if (data.items && data.totalItems > 0) {
          const info = data.items[0].volumeInfo;
          coverUrl =
            info.imageLinks?.thumbnail ??
            info.imageLinks?.smallThumbnail ??
            null;
        }
      }
    } catch (err) {
      console.error("Google Books cover search error:", err);
    }

    // 2. Try by ISBN (Open Library)
    if (!coverUrl) {
      try {
        const res = await fetch(
          `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanedIsbn}&format=json&jscmd=data`
        );
        if (res.ok) {
          const data = (await res.json()) as OpenLibraryResponse;
          const book = data[`ISBN:${cleanedIsbn}`];
          coverUrl = book?.cover?.medium ?? book?.cover?.small ?? null;
        }
      } catch (err) {
        console.error("Open Library cover search error:", err);
      }
    }
  }

  // 3. Try by title + author (Google Books)
  if (!coverUrl && title) {
    try {
      const q = encodeParams(title, author || "", cleanedIsbn || "");
      const url = apiKey
        ? `https://www.googleapis.com/books/v1/volumes?q=${q}&key=${apiKey}`
        : `https://www.googleapis.com/books/v1/volumes?q=${q}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as GoogleBooksVolume;
        if (data.items && data.totalItems > 0) {
          const info = data.items[0].volumeInfo;
          const foundTitle = info.title?.toLowerCase() || "";
          const queryTitle = title.toLowerCase();
          const titleMatch =
            foundTitle.includes(queryTitle) ||
            queryTitle.includes(foundTitle) ||
            foundTitle.split(" ").some((word) => queryTitle.includes(word));

          if (titleMatch) {
            coverUrl =
              info.imageLinks?.thumbnail ??
              info.imageLinks?.smallThumbnail ??
              null;
          }
        }
      }
    } catch (err) {
      console.error("Google Books title search error:", err);
    }
  }

  // 4. Try by title (Open Library search)
  if (!coverUrl && title) {
    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3${author ? `&author=${encodeURIComponent(author)}` : ""}`
      );
      if (res.ok) {
        const data = await res.json();
        const firstDoc = data?.docs?.[0];
        if (firstDoc?.isbn?.[0]) {
          const olRes = await fetch(
            `https://openlibrary.org/api/books?bibkeys=ISBN:${firstDoc.isbn[0]}&format=json&jscmd=data`
          );
          if (olRes.ok) {
            const olData = (await olRes.json()) as OpenLibraryResponse;
            const book = olData[`ISBN:${firstDoc.isbn[0]}`];
            coverUrl = book?.cover?.medium ?? book?.cover?.small ?? null;
          }
        }
      }
    } catch (err) {
      console.error("Open Library search error:", err);
    }
  }

  return coverUrl;
}

function encodeParams(title: string, author: string, isbn: string) {
  const parts: string[] = [];
  if (isbn) parts.push(`isbn:${isbn}`);
  if (title) parts.push(`intitle:${title}`);
  if (author) parts.push(`inauthor:${author}`);
  return parts.join("+");
}
