import { prisma } from "@/lib/prisma";
import { calculateJourney, completedThisYear } from "./journey-metrics";
import { dayLabel, storedDay } from "./calendar";

const bookSelect = {
  id: true, title: true, author: true, coverUrl: true, status: true, pages: true,
  currentPage: true, startedAt: true, finishedAt: true, createdAt: true,
} as const;

export async function getJourney(userId: string, now = new Date()) {
  const [books, setting, logs] = await Promise.all([
    prisma.book.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: bookSelect }),
    prisma.librarySetting.findUnique({ where: { userId }, select: { yearlyGoal: true, shareEnabled: true, shareId: true } }),
    prisma.readingLog.findMany({ where: { userId }, select: { id: true, date: true, pages: true, note: true, bookId: true } }),
  ]);
  const bookTitles = new Map(books.map(b => [b.id, b.title]));
  const recentNotes = logs.filter(log => log.note).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5)
    .map(log => ({ ...log, label: dayLabel(storedDay(log.date)), bookTitle: log.bookId ? bookTitles.get(log.bookId) ?? null : null }));
  return { ...calculateJourney(books, logs, setting?.yearlyGoal, now), setting, recentNotes };
}

export async function getSharedJourney(shareId: string, now = new Date()) {
  const setting = await prisma.librarySetting.findUnique({ where: { shareId }, select: { userId: true, name: true, yearlyGoal: true, shareEnabled: true } });
  if (!setting?.shareEnabled) return null;
  // Select only public catalog fields and page counts. Diary notes, private
  // book notes, ratings and session content never enter the public result.
  const [books, logs] = await Promise.all([
    prisma.book.findMany({ where: { userId: setting.userId }, orderBy: { updatedAt: "desc" }, select: bookSelect }),
    prisma.readingLog.findMany({ where: { userId: setting.userId }, select: { date: true, pages: true } }),
  ]);
  const metrics = calculateJourney(books, logs, setting.yearlyGoal, now);
  return {
    year: metrics.year, reading: metrics.reading, readThisYear: metrics.readThisYear,
    weekPages: metrics.weekPages, streak: metrics.streak, heatmap: metrics.heatmap,
    goalPct: metrics.goal.percentage, setting: { name: setting.name, yearlyGoal: setting.yearlyGoal },
  };
}

export async function getAnnualGoalStatus(userId: string, now = new Date()) {
  const [books, setting] = await Promise.all([
    prisma.book.findMany({ where: { userId, status: "READ" }, select: { status: true, finishedAt: true, createdAt: true } }),
    prisma.librarySetting.findUnique({ where: { userId }, select: { yearlyGoal: true } }),
  ]);
  return { completed: books.filter(b => completedThisYear(b, now)).length, target: setting?.yearlyGoal ?? null };
}
