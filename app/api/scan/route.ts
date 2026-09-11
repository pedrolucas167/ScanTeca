import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { findBookCover } from "@/lib/book-cover";
import { findSynopsis, cleanSynopsis } from "@/lib/synopsis";
import { findOriginalPublishYear, extractYear } from "@/lib/original-date";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";
import { getDefaultCollection } from "@/lib/default-collection";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import {
  cleanIsbn,
  cleanTitle,
  normalizeAuthor,
  normalizeGenre,
  upgradeCoverUrl,
  isUnknownTitle,
  isUnknownAuthor,
  findExistingBookByTitleAuthor,
} from "@/lib/book-metadata";
import { z } from "zod";

const scanSchema = z.object({
  isbn: z.string("ISBN é obrigatório").min(1, "ISBN é obrigatório"),
  status: z.enum(["READ", "READING", "TO_READ", "WISHLIST"]).optional(),
  preview: z.boolean().optional().default(false),
});

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

    const rateLimit = await rateLimitGuard(request, {
      route: "scan",
      userId,
      ...rateLimits.scan,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, scanSchema);
    if (!parsed.ok) return parsed.response;
    const { isbn, status, preview } = parsed.data;

    const cleanedIsbn = cleanIsbn(isbn);

    if (!cleanedIsbn) {
      return NextResponse.json(
        { error: `ISBN inválido: ${isbn} (deve ter 10 ou 13 dígitos)` },
        { status: 400 }
      );
    }

    const existing = await prisma.book.findUnique({
      where: {
        isbn_userId: {
          isbn: cleanedIsbn,
          userId,
        },
      },
      include: { collection: { select: { name: true } } },
    });

    if (existing) {
      return NextResponse.json(
        {
          book: { ...existing, collection: existing.collection.name },
          existing: true,
          message: "Livro já cadastrado",
        },
        { status: 200 }
      );
    }

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const googleUrl = apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanedIsbn}`;

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
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanedIsbn}&format=json&jscmd=data`
      );
      if (olRes.ok) {
        const olData = (await olRes.json()) as OpenLibraryResponse;
        const key = `ISBN:${cleanedIsbn}`;
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
            title: cleanTitle(olBook.title) ?? "Título desconhecido",
            author: normalizeAuthor(olBook.authors?.map((a) => a.name).join(", ")) ?? "Autor desconhecido",
            publishedDate: olBook.publish_date ?? null,
            synopsis,
            coverUrl: upgradeCoverUrl(olBook.cover?.medium ?? olBook.cover?.small),
            genre: normalizeGenre(olBook.subjects?.[0]?.name),
            pages: olBook.number_of_pages ?? null,
          };
        }
      }
    } catch (err) {
      console.error("Open Library API error:", err);
    }

    if (bookData && isUnknownAuthor(bookData.author)) {
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
              const found = normalizeAuthor(doc.author_name.join(", "));
              if (found) {
                bookData.author = found;
                console.log("[scan] author found via Open Library search:", bookData.author);
                break;
              }
            }
          }
        }

        if (isUnknownAuthor(bookData.author)) {
          const googleSearchUrl = apiKey
            ? `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${bookData.title}`)}&maxResults=5&key=${apiKey}`
            : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${bookData.title}`)}&maxResults=5`;

          const googleRes = await fetch(googleSearchUrl);
          if (googleRes.ok) {
            const googleData = (await googleRes.json()) as GoogleBooksVolume;
            if (googleData.items && googleData.totalItems > 0) {
              for (const item of googleData.items) {
                if (item.volumeInfo.authors?.length) {
                  const found = normalizeAuthor(item.volumeInfo.authors.join(", "));
                  if (found) {
                    bookData.author = found;
                    console.log("[scan] author found via Google Books search:", bookData.author);
                    break;
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Author lookup error:", err);
      }
    }

    if (!bookData) {
      try {
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            bookData = {
              title: cleanTitle(info.title) ?? "Título desconhecido",
              author: normalizeAuthor(info.authors?.join(", ")) ?? "Autor desconhecido",
              publishedDate: info.publishedDate ?? null,
              synopsis: info.description ? cleanSynopsis(info.description) : null,
              coverUrl: upgradeCoverUrl(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
              genre: normalizeGenre(info.categories?.[0]),
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

    if (!bookData || isUnknownTitle(bookData.title)) {
      return NextResponse.json(
        { error: "Nenhum livro encontrado para este ISBN" },
        { status: 404 }
      );
    }

    if (!bookData.genre || !bookData.pages) {
      try {
        const res = await fetch(googleUrl);
        if (res.ok) {
          const data = (await res.json()) as GoogleBooksVolume;
          if (data.items && data.totalItems > 0) {
            const info = data.items[0].volumeInfo;
            if (!bookData.genre && info.categories?.[0]) {
              bookData.genre = normalizeGenre(info.categories[0]);
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

    // Sempre busca uma capa validada. Se a fonte primária já tiver uma,
    // fazemos o upgrade, mas confiamos mais na validação do findBookCover
    // quando a capa original falta.
    const foundCover = await findBookCover({
      title: bookData.title,
      author: bookData.author,
      isbn: cleanedIsbn,
    });
    if (foundCover) {
      bookData.coverUrl = foundCover;
    } else if (bookData.coverUrl) {
      bookData.coverUrl = upgradeCoverUrl(bookData.coverUrl);
    }

    if (!bookData.synopsis) {
      const extraSynopsis = await findSynopsis({
        title: bookData.title,
        author: bookData.author,
        isbn: cleanedIsbn,
      });
      if (extraSynopsis) bookData.synopsis = extraSynopsis;
    }

    // Prefere a data da primeira publicação da obra, não da edição/reimpressão
    const originalYear = await findOriginalPublishYear({
      title: bookData.title,
      author: bookData.author,
      isbn: cleanedIsbn,
    });
    if (originalYear) {
      const currentYear = extractYear(bookData.publishedDate);
      if (!currentYear || originalYear < currentYear) {
        bookData.publishedDate = String(originalYear);
      }
    }

    // Última chance de evitar duplicata por título+autor (ISBN diferente ou manual).
    const existingSimilar = await findExistingBookByTitleAuthor(userId, bookData.title, bookData.author);
    if (existingSimilar) {
      return NextResponse.json(
        {
          book: { ...existingSimilar, collection: existingSimilar.collection.name },
          existing: true,
          message: "Livro já cadastrado",
        },
        { status: 200 }
      );
    }

    const collection = await getDefaultCollection(userId);

    // Modo preview: devolve os dados limpos para o usuário revisar antes de salvar.
    if (preview) {
      return NextResponse.json(
        {
          book: {
            isbn: cleanedIsbn,
            title: bookData.title,
            author: bookData.author,
            publishedDate: bookData.publishedDate,
            synopsis: bookData.synopsis,
            coverUrl: bookData.coverUrl,
            genre: bookData.genre,
            pages: bookData.pages,
            status: status || "TO_READ",
            collection: collection.name,
          },
          existing: false,
          message: "Livro encontrado",
        },
        { status: 200 }
      );
    }

    const book = await prisma.book.create({
      data: {
        isbn: cleanedIsbn,
        title: bookData.title,
        author: bookData.author,
        publishedDate: bookData.publishedDate,
        synopsis: bookData.synopsis,
        coverUrl: bookData.coverUrl,
        genre: bookData.genre,
        pages: bookData.pages,
        status: status || "TO_READ",
        collectionId: collection.id,
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

    return NextResponse.json(
      { book: { ...book, collection: collection.name }, message: "Livro adicionado com sucesso" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro em /api/scan:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
