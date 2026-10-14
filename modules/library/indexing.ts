import type { Book } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";

export async function refreshBookEmbedding(book: Book) {
  try {
    const embedding = await generateEmbedding(bookToEmbeddingText(book));
    if (!embedding) return;
    await prisma.$executeRaw`
      UPDATE "Book" SET embedding = ${`[${embedding.join(",")}]`}::vector
      WHERE id = ${book.id} AND "userId" = ${book.userId} AND "updatedAt" = ${book.updatedAt}
    `;
  } catch (error) {
    console.error("[library] Falha ao atualizar embedding:", error);
  }
}
