import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina SCANTECA_TEST_DATABASE_URL para a base local isolada de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") {
    throw new Error("Integração só aceita a base local scanteca_reading_test na porta 55439.");
  }
  return { prisma: new PrismaClient({ datasourceUrl: raw }) };
});
vi.mock("@/lib/embeddings", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
  diaryToEmbeddingText: () => "diary", bookToEmbeddingText: () => "book",
}));
vi.mock("@/lib/push", () => ({ notifyGoalIfReached: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/recommendations-cache", () => ({ invalidateRecommendationsCache: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "@/lib/prisma";
import { startReadingSession, pauseReadingSession } from "./sessions";
import { createAnnotation, addPassageComment, getReadingPage } from "./annotations";
import { saveDiaryEntry, deleteDiaryEntry } from "./diary";
import { updateBook } from "@/modules/library";
import { bookUpdateSchema } from "@/modules/library";
import { getJourney, getSharedJourney, getAnnualGoalStatus } from "./journey";

const owner = "reading-integration-owner";
let bookId: string;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reading_test_fail_log ON "ReadingLog"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reading_test_fail_log()');
  await prisma.book.deleteMany({ where: { userId: { startsWith: "reading-integration-" } } });
  await prisma.readingLog.deleteMany({ where: { userId: { startsWith: "reading-integration-" } } });
  await prisma.collection.deleteMany({ where: { userId: { startsWith: "reading-integration-" } } });
  await prisma.librarySetting.deleteMany({ where: { userId: { startsWith: "reading-integration-" } } });
  const collection = await prisma.collection.create({ data: { userId: owner, name: "Teste" } });
  const book = await prisma.book.create({ data: {
    userId: owner, collectionId: collection.id, isbn: "9788535902778", title: "Livro de teste",
    author: "Autor", pages: 100, currentPage: 10, status: "READING",
  } });
  bookId = book.id;
});

afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS reading_test_fail_log ON "ReadingLog"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS reading_test_fail_log()');
  await prisma.$disconnect();
});

describe("Leitura em PostgreSQL isolado", () => {
  it("inícios simultâneos preservam uma sessão ativa", async () => {
    const sessions = await Promise.all([startReadingSession(owner, bookId), startReadingSession(owner, bookId)]);
    expect(sessions[0].id).toBe(sessions[1].id);
    expect(await prisma.readingSession.count({ where: { userId: owner, endedAt: null } })).toBe(1);
  });

  it("pausas simultâneas e repetidas contam páginas uma vez", async () => {
    const session = await startReadingSession(owner, bookId);
    await Promise.all([pauseReadingSession(owner, session.id, 30), pauseReadingSession(owner, session.id, 30)]);
    await pauseReadingSession(owner, session.id, 30);
    expect((await prisma.readingLog.aggregate({ where: { userId: owner }, _sum: { pages: true } }))._sum.pages).toBe(20);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).currentPage).toBe(30);
    await expect(pauseReadingSession(owner, session.id, 40)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("pausar depois de registrar pelo catálogo não duplica páginas", async () => {
    const session = await startReadingSession(owner, bookId);
    await updateBook(owner, bookUpdateSchema.parse({ id: bookId, currentPage: 25 }));
    await pauseReadingSession(owner, session.id, 30);
    expect((await prisma.readingLog.aggregate({ where: { userId: owner }, _sum: { pages: true } }))._sum.pages).toBe(20);
  });

  it("não regride progresso já registrado por outro fluxo", async () => {
    const session = await startReadingSession(owner, bookId);
    await updateBook(owner, bookUpdateSchema.parse({ id: bookId, currentPage: 40 }));
    await pauseReadingSession(owner, session.id, 30);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).currentPage).toBe(40);
    expect((await prisma.readingLog.aggregate({ where: { userId: owner }, _sum: { pages: true } }))._sum.pages).toBe(30);
  });

  it("catálogo e pausa concorrentes preservam o total sem duplicação", async () => {
    const session = await startReadingSession(owner, bookId);
    await Promise.all([
      updateBook(owner, bookUpdateSchema.parse({ id: bookId, currentPage: 30 })),
      pauseReadingSession(owner, session.id, 30),
    ]);
    expect((await prisma.readingLog.aggregate({ where: { userId: owner }, _sum: { pages: true } }))._sum.pages).toBe(20);
  });

  it("falha no diário desfaz encerramento da sessão e progresso do livro", async () => {
    const session = await startReadingSession(owner, bookId);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION reading_test_fail_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated log failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reading_test_fail_log BEFORE INSERT OR UPDATE ON "ReadingLog" FOR EACH ROW EXECUTE FUNCTION reading_test_fail_log()`);
    await expect(pauseReadingSession(owner, session.id, 30)).rejects.toThrow();
    expect((await prisma.readingSession.findUniqueOrThrow({ where: { id: session.id } })).endedAt).toBeNull();
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).currentPage).toBe(10);
    expect(await prisma.readingLog.count({ where: { userId: owner } })).toBe(0);
  });

  it("bloqueia livro, sessão, página e anotações de outro usuário", async () => {
    const session = await startReadingSession(owner, bookId);
    await expect(startReadingSession("other", bookId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(pauseReadingSession("other", session.id, 30)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createAnnotation("other", { bookId, paragraph: 1, content: "x", type: "comment" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getReadingPage("other", bookId)).toBeNull();
    expect(await prisma.annotation.count()).toBe(0);
  });

  it("valida trecho, livro e sessão antes de salvar marginalia", async () => {
    const annotation = await createAnnotation(owner, { bookId, paragraph: 1, content: "Comentário", type: "comment" });
    await expect(addPassageComment("other", { bookId, passageId: annotation.passageId, content: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(addPassageComment(owner, { bookId: "wrong", passageId: annotation.passageId, content: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createAnnotation(owner, { bookId, paragraph: 2, content: "x", type: "comment", sessionId: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.annotation.count()).toBe(1);
  });

  it("diário valida páginas e proprietário ao criar, editar e excluir", async () => {
    const entry = await saveDiaryEntry(owner, { action: "entry", bookId, type: "REFLECTION", content: "Reflexão", tags: [], page: 20 });
    await expect(saveDiaryEntry(owner, { action: "updateEntry", entryId: entry.id, type: "QUOTE", content: "x", tags: [], page: 101 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(saveDiaryEntry("other", { action: "updateEntry", entryId: entry.id, type: "QUOTE", content: "x", tags: [] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteDiaryEntry("other", entry.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const updated = await saveDiaryEntry(owner, { action: "updateEntry", entryId: entry.id, type: "QUOTE", content: "Revisão", page: 30, tags: ["tema"] });
    expect(updated).toMatchObject({ content: "Revisão", page: 30, tags: ["tema"] });
    await deleteDiaryEntry(owner, entry.id);
    expect(await prisma.diaryEntry.count()).toBe(0);
  });

  it("rejeita sessão de outro livro ao criar entrada e páginas fora dos limites", async () => {
    const session = await startReadingSession(owner, bookId);
    await expect(pauseReadingSession(owner, session.id, 101)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(pauseReadingSession(owner, session.id, 9)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const collection = await prisma.collection.findFirstOrThrow({ where: { userId: owner } });
    const otherBook = await prisma.book.create({ data: { userId: owner, collectionId: collection.id, isbn: "manual-test", title: "Segundo", author: "Autor" } });
    await expect(saveDiaryEntry(owner, { action: "entry", bookId: otherBook.id, sessionId: session.id, type: "QUOTE", content: "x", tags: [] }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.diaryEntry.count()).toBe(0);
  });

  it("jornadas privada, pública e meta concordam no banco sem expor notas", async () => {
    const now = new Date("2027-01-01T02:45:00Z");
    await prisma.book.update({ where: { id: bookId }, data: {
      status: "READ", finishedAt: new Date("2027-01-01T02:00:00Z"), notes: "Nota privada do livro",
    } });
    await prisma.librarySetting.create({ data: { userId: owner, yearlyGoal: 1, shareId: "reading-integration-share", shareEnabled: true } });
    await prisma.readingLog.create({ data: { userId: owner, bookId, date: new Date("2026-12-31T00:00:00Z"), pages: 20, note: "Nota privada do diário" } });
    const personal = await getJourney(owner, now);
    const shared = await getSharedJourney("reading-integration-share", now);
    expect(personal).toMatchObject({ year: 2026, streak: 1, weekPages: 20, goal: { reached: true } });
    expect(personal.recentNotes[0]?.note).toBe("Nota privada do diário");
    expect(shared).toMatchObject({ year: 2026, streak: 1, weekPages: 20, goalPct: 100 });
    expect(JSON.stringify(shared)).not.toContain("Nota privada");
    expect(await getAnnualGoalStatus(owner, now)).toEqual({ completed: 1, target: 1 });
    await prisma.librarySetting.update({ where: { userId: owner }, data: { shareEnabled: false } });
    expect(await getSharedJourney("reading-integration-share", now)).toBeNull();
  });
});
