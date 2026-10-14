import { dayDate, dayLabel, daysBetween, readingDay, shiftDay, storedDay } from "./calendar";
import { calculateGoalProgress } from "./goals";

export interface JourneyBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  status: string;
  pages: number | null;
  currentPage: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface JourneyLog {
  date: Date;
  pages: number;
}

export const HEAT_WEEKS = 15;

export function completedThisYear(book: Pick<JourneyBook, "status" | "finishedAt" | "createdAt">, now: Date): boolean {
  const finished = book.finishedAt ?? book.createdAt;
  return book.status === "READ" && finished <= now && readingDay(finished).slice(0, 4) === readingDay(now).slice(0, 4);
}

function progress(book: JourneyBook, now: Date) {
  const total = book.pages != null && book.pages > 0 ? book.pages : null;
  const current = Math.max(0, Math.min(book.currentPage ?? 0, total ?? Infinity));
  const days = book.startedAt && book.startedAt <= now ? daysBetween(book.startedAt, now) : null;
  return {
    percentage: total ? Math.min(100, Math.round(current / total * 100)) : 0,
    days,
    etaDays: total && current > 0 && days ? Math.max(0, Math.ceil((total - current) / (current / days))) : null,
  };
}

export function calculateJourney<T extends JourneyBook>(
  books: T[], logs: JourneyLog[], yearlyGoal: number | null | undefined, now = new Date(),
) {
  const today = readingDay(now);
  const year = Number(today.slice(0, 4));
  const reading = books.filter(b => b.status === "READING").map(b => ({ ...b, progress: progress(b, now) }));
  const read = books.filter(b => b.status === "READ");
  const readThisYear = books.filter(b => completedThisYear(b, now));
  const queue = books.filter(b => b.status === "TO_READ").slice(0, 6);
  // Snapshot of catalogued progress, not a historical sum across rereadings.
  const pagesRead = read.reduce((sum, b) => sum + Math.max(0, b.pages ?? 0), 0)
    + reading.reduce((sum, b) => sum + Math.max(0, Math.min(b.currentPage ?? 0, b.pages && b.pages > 0 ? b.pages : Infinity)), 0);
  const paced = read.flatMap(b => b.startedAt && b.finishedAt && b.pages && b.pages > 0
    && b.finishedAt >= b.startedAt && b.finishedAt <= now
    ? [{ pages: b.pages, days: daysBetween(b.startedAt, b.finishedAt) }] : []);
  const pace = paced.length ? Math.round(paced.reduce((sum, b) => sum + b.pages / b.days, 0) / paced.length) : null;
  const avgDays = paced.length ? Math.round(paced.reduce((sum, b) => sum + b.days, 0) / paced.length) : null;

  const pagesByDay = new Map<string, number>();
  for (const log of logs) {
    const day = storedDay(log.date);
    if (day > today || log.pages <= 0) continue;
    pagesByDay.set(day, (pagesByDay.get(day) ?? 0) + log.pages);
  }
  let cursor = pagesByDay.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (pagesByDay.has(cursor)) { streak++; cursor = shiftDay(cursor, -1); }
  let bestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...pagesByDay.keys()].sort()) {
    run = previous && shiftDay(previous, 1) === day ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = day;
  }
  const weekStart = shiftDay(today, -6);
  const weekPages = [...pagesByDay].reduce((sum, [day, pages]) => sum + (day >= weekStart ? pages : 0), 0);
  // Sunday through Saturday, matching the seven rows in the existing UI.
  const heatEnd = shiftDay(today, 6 - dayDate(today).getUTCDay());
  const heatStart = shiftDay(heatEnd, -(HEAT_WEEKS * 7 - 1));
  const heatmap = Array.from({ length: HEAT_WEEKS * 7 }, (_, i) => {
    const day = shiftDay(heatStart, i);
    return { day, label: dayLabel(day), pages: pagesByDay.get(day) ?? 0 };
  });
  return {
    year, reading, readThisYear, queue, pagesRead, pace, avgDays, streak, bestStreak,
    weekPages, heatmap, goal: calculateGoalProgress(readThisYear.length, yearlyGoal),
  };
}
