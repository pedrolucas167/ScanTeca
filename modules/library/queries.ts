import { prisma } from "@/lib/prisma";

export async function getLibrarySettings(userId: string) {
  return prisma.librarySetting.upsert({ where: { userId }, update: {}, create: { userId, name: "Minha Biblioteca" } });
}

export async function getCatalog(userId: string) {
  const [books, setting] = await Promise.all([
    prisma.book.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { collection: { select: { name: true } } } }),
    getLibrarySettings(userId),
  ]);
  return { books: books.map(book => ({ ...book, collection: book.collection.name })), setting };
}

export async function getBookDetail(userId: string, id: string) {
  return prisma.book.findFirst({ where: { id, userId }, include: {
    reviews: { orderBy: { createdAt: "desc" } }, collection: { select: { name: true } },
  } });
}

export async function getSharedCatalog(shareId: string) {
  const setting = await prisma.librarySetting.findUnique({ where: { shareId }, select: { userId: true, shareEnabled: true, name: true } });
  if (!setting?.shareEnabled) return null;
  const books = await prisma.book.findMany({
    where: { userId: setting.userId }, orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, author: true, coverUrl: true, status: true, rating: true,
      publishedDate: true, genre: true, synopsis: true,
      collection: { select: { name: true } },
      reviews: { orderBy: { createdAt: "desc" }, select: { id: true, content: true, rating: true, userName: true, createdAt: true } },
    },
  });
  return { setting: { name: setting.name }, books, readCount: books.filter(book => book.status === "READ").length };
}
