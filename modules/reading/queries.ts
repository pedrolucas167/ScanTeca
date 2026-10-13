import { prisma } from "@/lib/prisma";

export async function getDiaryPage(userId: string) {
  const bookSelect = { id: true, title: true, author: true, coverUrl: true, pages: true, currentPage: true } as const;
  const [books, active, sessions, entries] = await Promise.all([
    prisma.book.findMany({ where: { userId, status: "READING" }, orderBy: { updatedAt: "desc" }, select: bookSelect }),
    prisma.readingSession.findFirst({ where: { userId, endedAt: null }, orderBy: { startedAt: "desc" }, include: { book: { select: bookSelect } } }),
    prisma.readingSession.findMany({ where: { userId, endedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 8, include: { book: { select: { title: true, author: true, coverUrl: true } }, _count: { select: { entries: true } } } }),
    prisma.diaryEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20, include: { book: { select: { title: true, author: true } } } }),
  ]);
  return { books, active, sessions, entries };
}
