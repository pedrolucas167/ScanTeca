import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DiaryClient from "./DiaryClient";

export const dynamic = "force-dynamic";

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ bookId?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { bookId } = await searchParams;

  const [books, active, sessions, entries] = await Promise.all([
    prisma.book.findMany({ where: { userId, status: "READING" }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, author: true, coverUrl: true, pages: true, currentPage: true } }),
    prisma.readingSession.findFirst({ where: { userId, endedAt: null }, orderBy: { startedAt: "desc" }, include: { book: { select: { id: true, title: true, author: true, coverUrl: true, pages: true, currentPage: true } } } }),
    prisma.readingSession.findMany({ where: { userId, endedAt: { not: null } }, orderBy: { startedAt: "desc" }, take: 8, include: { book: { select: { title: true, author: true, coverUrl: true } }, _count: { select: { entries: true } } } }),
    prisma.diaryEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20, include: { book: { select: { title: true, author: true } } } }),
  ]);

  return <DiaryClient books={books} initialActive={active} sessions={sessions} initialEntries={entries} initialBookId={bookId} />;
}
