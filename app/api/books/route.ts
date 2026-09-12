import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@prisma/client";
import { findBookCover } from "@/lib/book-cover";
import { findSynopsis, cleanSynopsis } from "@/lib/synopsis";
import { findOriginalPublishYear, extractYear } from "@/lib/original-date";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";
import { resolveCollection } from "@/lib/default-collection";
import { readJson, bookStatusSchema, optionalNumber } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import {
  cleanIsbn,
  cleanTitle,
  normalizeAuthor,
  normalizeGenre,
  upgradeCoverUrl,
  findExistingBookByTitleAuthor,
  isUnknownTitle,
} from "@/lib/book-metadata";
import { z } from "zod";

const withCollection = { collection: { select: { name: true } } } as const;

// Mantém o contrato da API: collection sai como string (nome), não como objeto.
function serializeBook<T extends { collection: { name: string } }>(book: T) {
  return { ...book, collection: book.collection.name };
}

const bookCreateSchema = z.object({
  isbn: z.string().nullish(),
  title: z.string("Título é obrigatório").trim().min(1, "Título é obrigatório"),
  author: z.string().nullish(),
  publishedDate: z.string().nullish(),
  synopsis: z.string().nullish(),
  coverUrl: z.string().nullish(),
  status: bookStatusSchema.nullish(),
  collection: z.string().nullish(),
  notes: z.string().nullish(),
  rating: optionalNumber,
  genre: z.string().nullish(),
  pages: optionalNumber,
  customOrder: optionalNumber,
});

const bookUpdateSchema = bookCreateSchema.partial().extend({
  id: z.string("ID do livro é obrigatório").min(1, "ID do livro é obrigatório"),
  currentPage: optionalNumber,
  sessionNote: z.string().nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "books",
      userId,
      ...rateLimits.books,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, bookCreateSchema);
    if (!parsed.ok) return parsed.response;
    const { isbn, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating, genre, pages, customOrder } = parsed.data;

    const cleanedIsbn = cleanIsbn(isbn);

    if (isbn && isbn.trim() && !cleanedIsbn) {
      return NextResponse.json(
        { error: "ISBN deve ter 10 ou 13 dígitos" },
        { status: 400 }
      );
    }

    const cleanedTitle = cleanTitle(title);
    const normalizedAuthor = normalizeAuthor(author);

    if (!cleanedTitle || isUnknownTitle(cleanedTitle)) {
      return NextResponse.json(
        { error: "Título é obrigatório" },
        { status: 400 }
      );
    }

    // 1. Duplicata por ISBN
    if (cleanedIsbn) {
      const existing = await prisma.book.findUnique({
        where: {
          isbn_userId: {
            isbn: cleanedIsbn,
            userId,
          },
        },
        include: withCollection,
      });
      if (existing) {
        return NextResponse.json(
          { book: serializeBook(existing), message: "Livro já cadastrado" },
          { status: 200 }
        );
      }
    }

    // 2. Duplicata por título + autor
    const existingSimilar = await findExistingBookByTitleAuthor(
      userId,
      cleanedTitle,
      normalizedAuthor
    );
    if (existingSimilar) {
      return NextResponse.json(
        {
          book: { ...existingSimilar, collection: existingSimilar.collection.name },
          message: "Livro já cadastrado",
        },
        { status: 200 }
      );
    }

    const authorParam = normalizedAuthor ?? undefined;

    // Busca capa: se o usuário forneceu uma URL, fazemos o upgrade; caso contrário,
    // buscamos uma capa confiável a partir de ISBN/título/autor.
    let effectiveCoverUrl: string | null = upgradeCoverUrl(coverUrl);
    if (!effectiveCoverUrl) {
      effectiveCoverUrl = await findBookCover({
        title: cleanedTitle,
        author: authorParam,
        isbn: cleanedIsbn || undefined,
      });
    }

    // Sinopse: limpa a fornecida ou busca.
    let effectiveSynopsis: string | null = cleanSynopsis(synopsis);
    if (!effectiveSynopsis) {
      effectiveSynopsis = await findSynopsis({
        title: cleanedTitle,
        author: authorParam,
        isbn: cleanedIsbn || undefined,
      });
    }

    const effectiveGenre = normalizeGenre(genre);

    let effectivePublishedDate: string | null = publishedDate || null;
    const originalYear = await findOriginalPublishYear({
      title: cleanedTitle,
      author: authorParam,
      isbn: cleanedIsbn || undefined,
    });
    if (originalYear) {
      const currentYear = extractYear(effectivePublishedDate);
      if (!currentYear || originalYear < currentYear) {
        effectivePublishedDate = String(originalYear);
      }
    }

    const bookCollection = await resolveCollection(userId, collection);

    const book = await prisma.book.create({
      data: {
        isbn: cleanedIsbn || `MANUAL-${crypto.randomUUID()}`,
        title: cleanedTitle,
        author: normalizedAuthor || "Autor desconhecido",
        publishedDate: effectivePublishedDate,
        synopsis: effectiveSynopsis,
        coverUrl: effectiveCoverUrl || null,
        status: status || BookStatus.TO_READ,
        collectionId: bookCollection.id,
        notes: notes || null,
        rating: rating ?? null,
        genre: effectiveGenre,
        pages: pages || null,
        customOrder: customOrder ?? null,
        userId,
      },
      include: withCollection,
    });

    const embedding = await generateEmbedding(
      bookToEmbeddingText({
        title: book.title,
        author: book.author,
        synopsis: book.synopsis,
        genre: book.genre,
        notes: book.notes,
        rating: book.rating,
      })
    );
    if (embedding) {
      const vector = `[${embedding.join(",")}]`;
      await prisma.$executeRaw`
        UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id}
      `;
    }

    return NextResponse.json(
      { book: serializeBook(book), message: "Livro adicionado com sucesso" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro em POST /api/books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "books",
      userId,
      ...rateLimits.books,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, bookUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const { id, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating, genre, pages, currentPage, customOrder, sessionNote } = parsed.data;

    const existing = await prisma.book.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    const newTitle = title !== undefined ? cleanTitle(title) ?? existing.title : existing.title;
    const newAuthor = author !== undefined ? (normalizeAuthor(author) || author || "Autor desconhecido") : existing.author;

    let effectiveCoverUrl: string | null = null;
    if (coverUrl === "" || coverUrl === undefined) {
      effectiveCoverUrl = await findBookCover({
        title: newTitle,
        author: newAuthor,
        isbn: existing.isbn,
      });
    } else {
      effectiveCoverUrl = upgradeCoverUrl(coverUrl);
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = newTitle;
    if (author !== undefined) data.author = newAuthor;
    if (publishedDate !== undefined) data.publishedDate = publishedDate || null;
    if (synopsis !== undefined) data.synopsis = cleanSynopsis(synopsis) || null;
    if (coverUrl !== undefined) data.coverUrl = effectiveCoverUrl || null;
    if (status !== undefined) {
      data.status = status;
      if (status === "READING") {
        if (!existing.startedAt) data.startedAt = new Date();
        data.finishedAt = null;
      } else if (status === "READ") {
        if (!existing.startedAt) data.startedAt = new Date();
        data.finishedAt = new Date();
      } else {
        data.finishedAt = null;
      }
    }
    if (currentPage !== undefined) data.currentPage = currentPage || null;
    if (collection !== undefined) {
      data.collectionId = (await resolveCollection(userId, collection)).id;
    }
    if (notes !== undefined) data.notes = notes || null;
    if (rating !== undefined) data.rating = rating ?? null;
    if (genre !== undefined) data.genre = genre || null;
    if (pages !== undefined) data.pages = pages || null;
    if (customOrder !== undefined) data.customOrder = customOrder ?? null;

    const book = await prisma.book.update({
      where: { id },
      data,
      include: withCollection,
    });

    const newPage = currentPage ? Number(currentPage) : null;
    if (newPage !== null && newPage > (existing.currentPage ?? 0)) {
      const delta = newPage - (existing.currentPage ?? 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cleanNote =
        typeof sessionNote === "string" && sessionNote.trim()
          ? sessionNote.trim()
          : null;
      const existingLog = cleanNote
        ? await prisma.readingLog.findUnique({
            where: { userId_date: { userId, date: today } },
          })
        : null;
      await prisma.readingLog.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
          pages: { increment: delta },
          ...(cleanNote
            ? {
                note: existingLog?.note
                  ? `${existingLog.note}\n${cleanNote}`
                  : cleanNote,
              }
            : {}),
        },
        create: {
          userId,
          bookId: id,
          date: today,
          pages: delta,
          note: cleanNote,
        },
      });
    }

    if (
      title !== undefined ||
      author !== undefined ||
      synopsis !== undefined ||
      genre !== undefined ||
      notes !== undefined ||
      rating !== undefined
    ) {
      const embedding = await generateEmbedding(
        bookToEmbeddingText({
          title: book.title,
          author: book.author,
          synopsis: book.synopsis,
          genre: book.genre,
          notes: book.notes,
          rating: book.rating,
        })
      );
      if (embedding) {
        const vector = `[${embedding.join(",")}]`;
        await prisma.$executeRaw`
          UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id}
        `;
      }
    }

    return NextResponse.json(
      { book: serializeBook(book), message: "Livro atualizado com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro em PATCH /api/books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "books",
      userId,
      ...rateLimits.books,
    });
    if (rateLimit) return rateLimit;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID do livro é obrigatório" },
        { status: 400 }
      );
    }

    const existing = await prisma.book.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    await prisma.book.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Livro removido com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro em DELETE /api/books:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
