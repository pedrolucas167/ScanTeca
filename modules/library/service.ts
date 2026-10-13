import { prisma } from "@/lib/prisma";
import { BookStatus, Prisma } from "@prisma/client";
import type { Book } from "@prisma/client";
import { planReadingTransition, recordDailyProgress, ReadingError } from "@/modules/reading";
import { findBookCover } from "@/lib/book-cover";
import { findSynopsis, cleanSynopsis } from "@/lib/synopsis";
import { findOriginalPublishYear, extractYear } from "@/lib/original-date";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";
import { resolveCollection } from "@/lib/default-collection";
import { notifyGoalIfReached } from "@/lib/push";
import { invalidateRecommendationsCache } from "@/lib/recommendations-cache";
import {
  cleanIsbn,
  cleanTitle,
  normalizeAuthor,
  normalizeGenre,
  upgradeCoverUrl,
  findExistingBookByTitleAuthor,
  isUnknownTitle,
} from "@/lib/book-metadata";
import type { CreateBookInput, UpdateBookInput } from "./contracts";
import { LibraryError } from "./errors";


const withCollection = { collection: { select: { name: true } } } as const;

// Mantém o contrato da API: collection sai como string (nome), não como objeto.
function serializeBook<T extends { collection: { name: string } }>(book: T) {
  return { ...book, collection: book.collection.name };
}

async function refreshBookEmbedding(book: Book) {
  try {
    const embedding = await generateEmbedding(bookToEmbeddingText(book));
    if (!embedding) return;
    const vector = `[${embedding.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id} AND "userId" = ${book.userId}
    `;
  } catch (error) {
    // The book is already committed. Indexing failure must not invite a retry
    // of a successful write; /api/embeddings/backfill can rebuild the index.
    console.error("[library] Falha ao atualizar embedding:", error);
  }
}

export async function createBook(userId: string, input: CreateBookInput) {
  const { isbn, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating, genre, pages, customOrder } = input;

  const cleanedIsbn = cleanIsbn(isbn);

  if (isbn && isbn.trim() && !cleanedIsbn) {
    throw new LibraryError("INVALID_INPUT", "ISBN deve ter 10 ou 13 dígitos");
  }

  const cleanedTitle = cleanTitle(title);
  const normalizedAuthor = normalizeAuthor(author);

  if (!cleanedTitle || isUnknownTitle(cleanedTitle)) {
    throw new LibraryError("INVALID_INPUT", "Título é obrigatório");
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
      return { book: serializeBook(existing), message: "Livro já cadastrado", created: false };
    }
  }

  // 2. Duplicata por título + autor
  const existingSimilar = await findExistingBookByTitleAuthor(
    userId,
    cleanedTitle,
    normalizedAuthor
  );
  if (existingSimilar) {
    return {
      book: serializeBook(existingSimilar),
      message: "Livro já cadastrado",
      created: false,
    };
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

  await refreshBookEmbedding(book);

  await invalidateRecommendationsCache(userId);

  return { book: serializeBook(book), message: "Livro adicionado com sucesso", created: true };
}

export async function updateBook(userId: string, input: UpdateBookInput) {
  const { id, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating, genre, pages, currentPage, customOrder, sessionNote, startReclube } = input;

  const existing = await prisma.book.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new LibraryError("NOT_FOUND", "Livro não encontrado");
  }

  const newTitle = title !== undefined ? cleanTitle(title) ?? existing.title : existing.title;
  const newAuthor = author !== undefined ? (normalizeAuthor(author) || author || "Autor desconhecido") : existing.author;

  let effectiveCoverUrl: string | null = null;
  if (coverUrl === "") {
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
  if (collection !== undefined) {
    data.collectionId = (await resolveCollection(userId, collection)).id;
  }
  if (notes !== undefined) data.notes = notes || null;
  if (rating !== undefined) data.rating = rating ?? null;
  if (genre !== undefined) data.genre = genre || null;
  if (pages !== undefined) data.pages = pages || null;
  if (customOrder !== undefined) data.customOrder = customOrder ?? null;

  const { book, completed } = await updateBookAndProgress(userId, id, data, {
    status, currentPage, startReclube, sessionNote,
  });
  if (completed) {
    notifyGoalIfReached(userId).catch(() => {});
  }

  const semanticChange =
    title !== undefined ||
    author !== undefined ||
    synopsis !== undefined ||
    genre !== undefined ||
    notes !== undefined ||
    rating !== undefined ||
    status !== undefined || startReclube === true;

  if (semanticChange) {
    await invalidateRecommendationsCache(userId);
  }

  if (
    title !== undefined ||
    author !== undefined ||
    synopsis !== undefined ||
    genre !== undefined ||
    notes !== undefined ||
    rating !== undefined
  ) {
    await refreshBookEmbedding(book);
  }

  return { book: serializeBook(book), message: "Livro atualizado com sucesso" };
}

async function updateBookAndProgress(
  userId: string,
  id: string,
  metadata: Record<string, unknown>,
  change: Pick<UpdateBookInput, "status" | "currentPage" | "startReclube" | "sessionNote">,
) {
  // Re-read inside a serializable transaction: concurrent requests must not
  // count the same progress twice. Only database work is retried.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const current = await tx.book.findFirst({ where: { id, userId } });
        if (!current) throw new LibraryError("NOT_FOUND", "Livro não encontrado");
        const transition = planReadingTransition(current, change);
        const book = await tx.book.update({
          where: { id, userId },
          data: { ...metadata, ...transition.data },
          include: withCollection,
        });
        await recordDailyProgress(tx, {
          userId, bookId: id, pages: transition.pagesRead, note: change.sessionNote,
        });
        return { book, completed: transition.completed };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ReadingError) throw new LibraryError("INVALID_INPUT", error.message);
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  throw new LibraryError("CONFLICT", "O livro foi alterado simultaneamente. Tente novamente.");
}

export async function deleteBook(userId: string, id: string) {
  const existing = await prisma.book.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    throw new LibraryError("NOT_FOUND", "Livro não encontrado");
  }

  await prisma.book.delete({
    where: { id, userId },
  });

  await invalidateRecommendationsCache(userId);

  return { message: "Livro removido com sucesso" };
}
