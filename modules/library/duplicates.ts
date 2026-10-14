import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isBookSimilar } from "@/lib/book-metadata";

export async function findExistingBookByTitleAuthor(
  userId: string, title: string, author: string | null | undefined,
  db: Pick<Prisma.TransactionClient, "book"> = prisma,
) {
  const books = await db.book.findMany({ where: { userId }, include: { collection: { select: { name: true } } } });
  return books.find(book => isBookSimilar(title, author ?? null, book.title, book.author)) ?? null;
}
