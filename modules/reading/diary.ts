import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { diaryToEmbeddingText, generateEmbedding } from "@/lib/embeddings";
import type { DiaryCommand } from "./contracts";
import { readingTransaction } from "./transaction";
import { ReadingError } from "./transitions";

const bookInfo = { book: { select: { title: true, author: true } } } as const;

async function requireBook(tx: Prisma.TransactionClient, userId: string, bookId: string, page?: number | null) {
  const book = await tx.book.findFirst({ where: { id: bookId, userId }, select: { pages: true } });
  if (!book) throw new ReadingError("Livro não encontrado", "NOT_FOUND");
  if (page != null && book.pages != null && page > book.pages) throw new ReadingError(`A página não pode ultrapassar ${book.pages}`);
}

async function indexEntry(entry: Prisma.DiaryEntryGetPayload<{ include: typeof bookInfo }>) {
  try {
    const embedding = await generateEmbedding(diaryToEmbeddingText(entry));
    if (!embedding) return;
    // A slower index job cannot overwrite the vector of a newer edit.
    await prisma.$executeRaw`
      UPDATE "DiaryEntry" SET embedding = ${`[${embedding.join(",")}]`}::vector
      WHERE id = ${entry.id} AND "userId" = ${entry.userId} AND "updatedAt" = ${entry.updatedAt}
    `;
  } catch (error) {
    console.error("[reading] Falha ao indexar diário:", error);
  }
}

export async function saveDiaryEntry(userId: string, input: Extract<DiaryCommand, { action: "entry" | "updateEntry" }>) {
  const entry = await readingTransaction(async tx => {
    const existing = input.action === "updateEntry"
      ? await tx.diaryEntry.findFirst({ where: { id: input.entryId, userId } }) : null;
    if (input.action === "updateEntry" && !existing) throw new ReadingError("Anotação não encontrada", "NOT_FOUND");
    const bookId = input.action === "entry" ? input.bookId : existing!.bookId;
    await requireBook(tx, userId, bookId, input.page);
    if (input.action === "entry" && input.sessionId) {
      const session = await tx.readingSession.findFirst({ where: { id: input.sessionId, userId, bookId } });
      if (!session) throw new ReadingError("Sessão não encontrada", "NOT_FOUND");
    }
    const data = { type: input.type, content: input.content, page: input.page, tags: input.tags };
    if (input.action === "entry") {
      return tx.diaryEntry.create({ data: { ...data, userId, bookId, sessionId: input.sessionId }, include: bookInfo });
    }
    const updated = await tx.diaryEntry.update({ where: { id: input.entryId, userId }, data, include: bookInfo });
    await tx.$executeRaw`UPDATE "DiaryEntry" SET embedding = NULL WHERE id = ${updated.id} AND "userId" = ${userId}`;
    return updated;
  });
  await indexEntry(entry);
  return entry;
}

export async function deleteDiaryEntry(userId: string, entryId: string) {
  const result = await prisma.diaryEntry.deleteMany({ where: { id: entryId, userId } });
  if (!result.count) throw new ReadingError("Anotação não encontrada", "NOT_FOUND");
  return { ok: true };
}
