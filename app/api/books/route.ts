import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { BookStatus } from "@prisma/client";
import { findBookCover } from "@/lib/book-cover";
import { findSynopsis } from "@/lib/synopsis";
import { findOriginalPublishYear, extractYear } from "@/lib/original-date";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";
import { getDefaultCollection, resolveCollection } from "@/lib/default-collection";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { isbn, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating, genre, pages, customOrder } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Título é obrigatório" },
        { status: 400 }
      );
    }

    const cleanedIsbn = isbn ? isbn.replace(/[^0-9X]/gi, "") : null;

    if (cleanedIsbn && cleanedIsbn.length !== 10 && cleanedIsbn.length !== 13) {
      return NextResponse.json(
        { error: "ISBN deve ter 10 ou 13 dígitos" },
        { status: 400 }
      );
    }

    const existing = cleanedIsbn
      ? await prisma.book.findUnique({
          where: {
            isbn_userId: {
              isbn: cleanedIsbn,
              userId,
            },
          },
        })
      : null;

    if (existing) {
      return NextResponse.json(
        { book: existing, message: "Livro já cadastrado" },
        { status: 200 }
      );
    }

    const effectiveCoverUrl = coverUrl ||
      (await findBookCover({ title, author, isbn: cleanedIsbn || undefined }));
    const effectiveSynopsis =
      synopsis ||
      (await findSynopsis({
        title,
        author,
        isbn: cleanedIsbn || undefined,
      }));

    let effectivePublishedDate: string | null = publishedDate || null;
    const originalYear = await findOriginalPublishYear({
      title,
      author,
      isbn: cleanedIsbn || undefined,
    });
    if (originalYear) {
      const currentYear = extractYear(effectivePublishedDate);
      if (!currentYear || originalYear < currentYear) {
        effectivePublishedDate = String(originalYear);
      }
    }

    const defaultCollection = await getDefaultCollection(userId);

    const book = await prisma.book.create({
      data: {
        isbn: cleanedIsbn || `MANUAL-${crypto.randomUUID()}`,
        title,
        author: author || "Autor desconhecido",
        publishedDate: effectivePublishedDate,
        synopsis: effectiveSynopsis,
        coverUrl: effectiveCoverUrl || null,
        status: (status as BookStatus) || BookStatus.TO_READ,
        collection: resolveCollection(collection, defaultCollection),
        notes: notes || null,
        rating: rating ?? null,
        genre: genre || null,
        pages: pages ? Number(pages) : null,
        customOrder: customOrder ?? null,
        userId,
      },
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
      { book, message: "Livro adicionado com sucesso" },
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

    const body = await request.json();
    const { id, title, author, publishedDate, synopsis, coverUrl, status, collection, notes, rating, genre, pages, currentPage, customOrder, sessionNote } = body;

    if (!id || typeof id !== "string") {
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

    let effectiveCoverUrl = coverUrl;
    if (coverUrl === "" || coverUrl === undefined) {
      effectiveCoverUrl = await findBookCover({
        title: existing.title,
        author: existing.author,
        isbn: existing.isbn,
      });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (author !== undefined) data.author = author || "Autor desconhecido";
    if (publishedDate !== undefined) data.publishedDate = publishedDate || null;
    if (synopsis !== undefined) data.synopsis = synopsis || null;
    if (coverUrl !== undefined) data.coverUrl = effectiveCoverUrl || null;
    if (status !== undefined) {
      data.status = status as BookStatus;
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
    if (currentPage !== undefined) data.currentPage = currentPage ? Number(currentPage) : null;
    if (collection !== undefined) {
      const defaultCollection = await getDefaultCollection(userId);
      data.collection = resolveCollection(collection, defaultCollection);
    }
    if (notes !== undefined) data.notes = notes || null;
    if (rating !== undefined) data.rating = rating ?? null;
    if (genre !== undefined) data.genre = genre || null;
    if (pages !== undefined) data.pages = pages ? Number(pages) : null;
    if (customOrder !== undefined) data.customOrder = customOrder ?? null;

    const book = await prisma.book.update({
      where: { id },
      data,
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
      { book, message: "Livro atualizado com sucesso" },
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
