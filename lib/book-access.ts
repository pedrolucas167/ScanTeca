import { prisma } from "@/lib/prisma";

// Mesma autorização para listar/criar discussões e responder a elas.
export async function accessibleBook(bookId: string, userId: string) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, userId: true },
  });
  if (!book) return null;
  if (book.userId === userId) return book;
  const shared = await prisma.librarySetting.findFirst({
    where: { userId: book.userId, shareEnabled: true },
    select: { id: true },
  });
  return shared ? book : null;
}
