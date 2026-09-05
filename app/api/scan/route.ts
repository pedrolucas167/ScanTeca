import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { findBookCover } from "@/lib/book-cover";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";

interface GoogleBooksVolume {
  totalItems: number;
  items?: {
    volumeInfo: {
      title?: string;
      authors?: string[];
      publishedDate?: string;
      description?: string;
      pageCount?: number;
      categories?: string[];
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }[];
}

interface OpenLibraryBook {
  title?: string;
  authors?: { name: string }[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: { name: string }[];
  cover?: { medium?: string; small?: string };
  works?: { key: string }[];
}

interface OpenLibraryResponse {
  [key: string]: OpenLibraryBook;
}

interface OpenLibraryWork {
  description?:
    | string
    | { type: string; value: string };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isbn } = body as { isbn: string };

    if (!isbn || typeof isbn !== "string") {
      return NextResponse.json(
        { error: "ISBN é obrigatório" },
        { status: 400 }
      );
    }

    const cleaned = isbn.replace(/[^0-9X]/gi, "");

    // Validate ISBN length (10 or 13 digits)
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      return NextResponse.json(
        { error: `ISBN inválido: ${cleaned} (deve ter 10 ou 13 dígitos)` },
        { status: 400 }
      );
    }

    const existing = await prisma.book.findUnique({
      where: {
        isbn_userId: {
          isbn: cleaned,
          userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { book: existing, message: "Livro já cadastrado" },
        { status: 200 }
      );
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const googleUrl = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}`;

    let bookData: {
      title: string;
      author: string;
      publishedDate: string | null;
      synopsis: string | null;
      coverUrl: string | null;
      genre: string | null;
      pages: number | null;
    } | null = null;

    // Try Open Library first (more reliable for ISBN lookups)
    try {
      const olRes = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&format=json&jscmd=data`
      );
      if (olRes.ok) {
        const olData = (await olRes.json()) as OpenLibraryResponse;
        const key = `ISBN:${cleaned}`;
        const olBook = olData[key];
        if (olBook) {
          let synopsis: string | null = null;

          // Try to fetch work description for better synopsis
          const workKey = olBook.works?.[0]?.key;
          if (workKey) {
            try {
              const workRes = await fetch(
                `https://openlibrary.org${workKey}.json`
              );
              if (workRes.ok) {
                const work = (await workRes.json()) as OpenLibraryWork;
                const raw = work.description;
                synopsis =
                  typeof raw === "string"
                    ? raw
                    : (raw?.value ?? null);
              }
            } catch (err) {
              console.error("Open Library Work API error:", err);
            }
          }

          bookData = {
            title: olBook.title ?? "Título desconhecido",
            author: olBook.authors?.map((a) => a.name).join(", ") ?? "Autor desconhecido",
            publishedDate: olBook.publish_date ?? null,
            synopsis,
            coverUrl: olBook.cover?.medium ?? olBook.cover?.small ?? null,
            genre: olBook.subjects?.[0]?.name ?? null,
            pages: olBook.number_of_pages ?? null,
          };
        }
      }
    } catch (err) {
      console.error("Open Library API error:", err);
    }

    // If author is missing, try to find it by title
    if (bookData && (bookData.author === "Autor desconhecido" || !bookData.author)) {
      try {
        const searchRes = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(bookData.title)}&limit=5`
        );
        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as {
            docs?: { author_name?: string[]; title?: string }[];
          };
          const docs = searchData?.docs || [];
          for (const doc of docs) {
            if (doc?.author_name?.length) {
              bookData.author = doc.author_name.join(", ");
              console.log("[scan] author found via Open Library search:", bookData.author);
              break;
            }
          }
        }

        if (bookData.author === "Autor desconhecido" || !bookData.author) {
          const googleSearchUrl = apiKey
            ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${bookData.title}`)}&maxResults=5&key=${apiKey}`
            : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${bookData.title}`)}&maxResults=5`;

          const googleRes = await fetch(googleSearchUrl);
          if (googleRes.ok) {
            const googleData = (await googleRes.json()) as GoogleBooksVolume;
            if (googleData.items && googleData.totalItems > 0) {
              for (const item of googleData.items) {
                if (item.volumeInfo.authors?.length) {
                  bookData.author = item.volumeInfo.authors.join(", ");
                  console.log("[scan] author found via Google Books search:", bookData.author);
                  break;
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Author lookup error:", err);
      }
    }

    // Fallback to Google Books if Open Library returned nothing
    if (!bookData) {
      try {
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            bookData = {
              title: info.title ?? "Título desconhecido",
              author: info.authors?.join(", ") ?? "Autor desconhecido",
              publishedDate: info.publishedDate ?? null,
              synopsis: info.description ?? null,
              coverUrl: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null,
              genre: info.categories?.[0] ?? null,
              pages: info.pageCount ?? null,
            };
          }
        } else {
          console.error(`Google Books API: status=${res.status}`);
        }
      } catch (err) {
        console.error("Google Books API error:", err);
      }
    }

    if (!bookData) {
      return NextResponse.json(
        { error: "Nenhum livro encontrado para este ISBN" },
        { status: 404 }
      );
    }

    // Enrich with Google Books data (genre/pages) if missing
    if (!bookData.genre || !bookData.pages) {
      try {
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            if (!bookData.genre && info.categories?.[0]) {
              bookData.genre = info.categories[0];
            }
            if (!bookData.pages && info.pageCount) {
              bookData.pages = info.pageCount;
            }
          }
        }
      } catch (err) {
        console.error("Google Books enrichment error:", err);
      }
    }

    // Try to find a cover if missing
    if (!bookData.coverUrl) {
      const extraCover = await findBookCover({
        title: bookData.title,
        author: bookData.author,
        isbn: cleaned,
      });
      if (extraCover) bookData.coverUrl = extraCover;
    }

    const book = await prisma.book.create({
      data: {
        isbn: cleaned,
        title: bookData.title,
        author: bookData.author,
        publishedDate: bookData.publishedDate,
        synopsis: bookData.synopsis,
        coverUrl: bookData.coverUrl,
        genre: bookData.genre,
        pages: bookData.pages,
        userId,
      },
    });

    // Generate and store embedding (adds ~1s latency to the response)
    const embedding = await generateEmbedding(
      bookToEmbeddingText({
        title: bookData.title,
        author: bookData.author,
        synopsis: bookData.synopsis,
        genre: bookData.genre,
      })
    );
    if (embedding) {
      const vector = `[${embedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id}
      `;
    }

    return NextResponse.json({ book, message: "Livro adicionado com sucesso" }, { status: 201 });
  } catch (error) {
    console.error("Erro em /api/scan:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
