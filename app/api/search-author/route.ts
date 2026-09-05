import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

interface GoogleBooksVolume {
  totalItems: number;
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
    };
  }[];
}

interface OpenLibrarySearchDoc {
  title?: string;
  author_name?: string[];
}

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { title, isbn } = body as { title?: string; isbn?: string };

    if (!title && !isbn) {
      return NextResponse.json(
        { error: "Título ou ISBN é obrigatório" },
        { status: 400 }
      );
    }

    const cleanedIsbn = isbn ? isbn.replace(/[^0-9X]/gi, "") : "";
    const searchTitle = title ? title.trim() : "";
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

    // 1. Try by ISBN first
    if (cleanedIsbn) {
      try {
        const res = await fetch(
          `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanedIsbn}&format=json&jscmd=data`
        );
        if (res.ok) {
          const data = (await res.json()) as Record<string, { authors?: { name: string }[] }>;
          const book = data[`ISBN:${cleanedIsbn}`];
          if (book?.authors?.length) {
            const author = book.authors.map((a) => a.name).join(", ");
            return NextResponse.json({ author });
          }
        }
      } catch (err) {
        console.error("Open Library ISBN author search error:", err);
      }

      try {
        const url = apiKey
          ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&maxResults=5&key=${apiKey}`
          : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&maxResults=5`;

        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            if (info.authors?.length) {
              return NextResponse.json({ author: info.authors.join(", ") });
            }
          }
        }
      } catch (err) {
        console.error("Google Books ISBN author search error:", err);
      }
    }

    // 2. Try by title
    if (searchTitle) {
      try {
        const res = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTitle)}&limit=5`
        );
        if (res.ok) {
          const data = (await res.json()) as OpenLibrarySearchResponse;
          const docs = data?.docs || [];
          for (const doc of docs) {
            if (doc?.author_name?.length) {
              return NextResponse.json({ author: doc.author_name.join(", ") });
            }
          }
        }
      } catch (err) {
        console.error("Open Library title author search error:", err);
      }

      try {
        const url = apiKey
          ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${searchTitle}`)}&maxResults=5&key=${apiKey}`
          : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${searchTitle}`)}&maxResults=5`;

        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            for (const item of data.items) {
              if (item.volumeInfo.authors?.length) {
                return NextResponse.json({
                  author: item.volumeInfo.authors.join(", "),
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Google Books title author search error:", err);
      }
    }

    return NextResponse.json(
      { error: "Nenhum autor encontrado" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Erro em /api/search-author:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
