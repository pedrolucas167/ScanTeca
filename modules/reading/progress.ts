import type { Prisma } from "@prisma/client";

// Receives the caller's transaction so book and daily log commit together.
export async function recordDailyProgress(
  tx: Prisma.TransactionClient,
  input: { userId: string; bookId: string; pages: number; note?: string | null },
) {
  if (input.pages <= 0) return;
  // A Date column stores a calendar day; use the product's timezone, not the host's.
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => dateParts.find(p => p.type === name)!.value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
  const note = input.note?.trim() || null;
  const where = { userId_date: { userId: input.userId, date } };
  const existing = note ? await tx.readingLog.findUnique({ where }) : null;
  await tx.readingLog.upsert({
    where,
    update: {
      pages: { increment: input.pages },
      ...(note ? { note: existing?.note ? `${existing.note}\n${note}` : note } : {}),
    },
    create: { userId: input.userId, bookId: input.bookId, date, pages: input.pages, note },
  });
}
