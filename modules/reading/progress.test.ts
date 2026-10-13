import { afterEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { recordDailyProgress } from "./progress";

afterEach(() => vi.useRealTimers());

it("usa o dia de São Paulo e concatena a nota do registro diário", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-14T01:00:00Z")); // 22h de 13/10 em São Paulo
  const upsert = vi.fn();
  const findUnique = vi.fn().mockResolvedValue({ note: "Primeira sessão" });
  const tx = { readingLog: { upsert, findUnique } } as unknown as Prisma.TransactionClient;
  await recordDailyProgress(tx, { userId: "u1", bookId: "b1", pages: 10, note: " Segunda sessão " });
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId_date: { userId: "u1", date: new Date("2026-10-13T00:00:00Z") } },
    update: { pages: { increment: 10 }, note: "Primeira sessão\nSegunda sessão" },
  }));
});
