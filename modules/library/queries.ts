import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { measureServerTask } from "@/lib/server-timing";

export async function getLibrarySettings(userId: string) {
  const existing = await prisma.librarySetting.findUnique({ where: { userId } });
  if (existing) return existing;
  try {
    return await prisma.librarySetting.create({ data: { userId, name: "Minha Biblioteca" } });
  } catch (error) {
    // Two first visits may race. Read the winner instead of failing or
    // overwriting an existing library's name, sharing preferences or theme.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.librarySetting.findUniqueOrThrow({ where: { userId } });
    }
    throw error;
  }
}

export async function getCatalog(userId: string) {
  const [books, setting] = await Promise.all([
    measureServerTask("catalog.books", () => prisma.book.findMany({
      where: { userId }, orderBy: { createdAt: "desc" },
      select: {
        id: true, isbn: true, title: true, author: true, publishedDate: true,
        coverUrl: true, status: true, currentPage: true, rating: true, genre: true,
        pages: true, customOrder: true, createdAt: true,
        collection: { select: { name: true } },
      },
    })),
    measureServerTask("catalog.settings", () => getLibrarySettings(userId)),
  ]);
  return { books: books.map(book => ({ ...book, collection: book.collection.name })), setting };
}

export async function getCatalogDetails(userId: string, id?: string) {
  const books = await prisma.book.findMany({
    where: { userId, ...(id ? { id } : {}) }, orderBy: { createdAt: "desc" },
    include: { collection: { select: { name: true } } },
  });
  return books.map(book => ({ ...book, collection: book.collection.name }));
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
