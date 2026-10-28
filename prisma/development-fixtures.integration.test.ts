import { createPrismaClient } from "../lib/prisma-client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { fixtureId, seedDevelopment } from "./development-fixtures";

const raw = process.env.SCANTECA_TEST_DATABASE_URL;
if (!raw) throw new Error("Defina a base local isolada de testes.");
const url = new URL(raw);
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Base de integração não permitida.");
const prisma = createPrismaClient(raw);
const userId = "user_development_fixture_test";
const other = "user_development_fixture_other";
const now = new Date("2026-10-13T15:00:00Z");
async function cleanup() {
  const users = { in: [userId, other] };
  await prisma.book.deleteMany({ where: { userId: users } });
  await prisma.readingLog.deleteMany({ where: { userId: users } });
  await prisma.collection.deleteMany({ where: { userId: users } });
  await prisma.librarySetting.deleteMany({ where: { userId: users } });
}
beforeEach(cleanup);
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

describe("fixtures com PostgreSQL", () => {
  it("cria relações válidas e repetir em outro dia preserva edições", async () => {
    await seedDevelopment(prisma, userId, now);
    await prisma.book.update({ where: { id: fixtureId(userId, "reading") }, data: { currentPage: 75, notes: "Edição manual" } });
    await seedDevelopment(prisma, userId, new Date("2026-10-14T15:00:00Z"));
    expect(await prisma.book.count({ where: { userId } })).toBe(4);
    expect(await prisma.readingLog.count({ where: { userId } })).toBe(1);
    expect(await prisma.readingSession.count({ where: { userId } })).toBe(1);
    expect(await prisma.diaryEntry.count({ where: { userId } })).toBe(1);
    expect(await prisma.annotation.count({ where: { userId } })).toBe(1);
    expect(await prisma.book.findUnique({ where: { id: fixtureId(userId, "reading") } })).toMatchObject({ currentPage: 75, notes: "Edição manual" });
    const diary = await prisma.diaryEntry.findFirstOrThrow({ where: { userId }, include: { book: true, session: true } });
    expect(diary.book.userId).toBe(userId);
    expect(diary.session?.bookId).toBe(diary.bookId);
  });
  it("execuções simultâneas não duplicam e contas recebem acervos próprios", async () => {
    await Promise.all([seedDevelopment(prisma, userId, now), seedDevelopment(prisma, userId, now)]);
    await seedDevelopment(prisma, other, now);
    expect(await prisma.book.count({ where: { userId } })).toBe(4);
    expect(await prisma.book.count({ where: { userId: other } })).toBe(4);
    expect(await prisma.collection.count({ where: { userId } })).toBe(2);
  });
  it("preserva configurações e atividade existentes", async () => {
    await prisma.librarySetting.create({ data: { userId, name: "Meu acervo", yearlyGoal: 30 } });
    await prisma.readingLog.create({ data: { userId, date: new Date("2026-10-12T00:00:00Z"), pages: 99 } });
    await seedDevelopment(prisma, userId, now);
    expect(await prisma.librarySetting.findUnique({ where: { userId } })).toMatchObject({ name: "Meu acervo", yearlyGoal: 30 });
    expect(await prisma.readingLog.findFirst({ where: { userId } })).toMatchObject({ pages: 99 });
  });
  it("desfaz toda a carga quando uma gravação falha", async () => {
    await prisma.collection.create({ data: { id: "fixture-conflict-collection", userId: other, name: "Conflito" } });
    await prisma.book.create({ data: { id: "fixture-conflict-book", userId, collectionId: "fixture-conflict-collection", isbn: "DEV-FIXTURE-reading", title: "Já cadastrado", author: "Teste" } });
    await expect(seedDevelopment(prisma, userId, now)).rejects.toThrow();
    expect(await prisma.book.count({ where: { userId } })).toBe(1);
    expect(await prisma.collection.count({ where: { userId } })).toBe(0);
    expect(await prisma.librarySetting.count({ where: { userId } })).toBe(0);
  });
});
