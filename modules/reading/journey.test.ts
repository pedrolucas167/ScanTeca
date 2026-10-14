import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {
  book: { findMany: vi.fn() }, librarySetting: { findUnique: vi.fn() }, readingLog: { findMany: vi.fn() },
} }));
import { prisma } from "@/lib/prisma";
import { getJourney, getSharedJourney, getAnnualGoalStatus } from "./journey";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.book.findMany).mockResolvedValue([]);
  vi.mocked(prisma.readingLog.findMany).mockResolvedValue([]);
});
it("não consulta acervo quando compartilhamento está desligado", async () => {
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue({ shareEnabled: false } as never);
  expect(await getSharedJourney("share")).toBeNull();
  expect(prisma.book.findMany).not.toHaveBeenCalled();
});
it("jornada pública consulta somente dados necessários e não retorna notas", async () => {
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue({ userId: "owner", shareEnabled: true, name: "Acervo", yearlyGoal: 10 } as never);
  const result = await getSharedJourney("share");
  expect(prisma.book.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" }, select: expect.not.objectContaining({ notes: true }) }));
  expect(prisma.readingLog.findMany).toHaveBeenCalledWith({ where: { userId: "owner" }, select: { date: true, pages: true } });
  expect(result).not.toHaveProperty("recentNotes");
  expect(result?.setting).toEqual({ name: "Acervo", yearlyGoal: 10 });
});
it("jornada privada mantém notas, identificação do livro e filtro do proprietário", async () => {
  vi.mocked(prisma.readingLog.findMany).mockResolvedValue([{ id: "l1", date: new Date("2026-10-13T00:00:00Z"), pages: 10, note: "Privado", bookId: "b1" }] as never);
  const result = await getJourney("u1");
  expect(prisma.book.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" } }));
  expect(result.recentNotes[0]).toMatchObject({ label: "13/10/2026", note: "Privado" });
});
it("notificação e jornada usam a mesma regra de ano local", async () => {
  vi.mocked(prisma.book.findMany).mockResolvedValue([{ status: "READ", finishedAt: new Date("2027-01-01T02:00:00Z"), createdAt: new Date("2026-01-02T12:00:00Z") }] as never);
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue({ yearlyGoal: 1 } as never);
  expect(await getAnnualGoalStatus("u1", new Date("2027-01-01T02:45:00Z"))).toEqual({ completed: 1, target: 1 });
});
