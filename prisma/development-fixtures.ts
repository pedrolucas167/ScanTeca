import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

/** Never falls back to the application's database or an arbitrary account. */
export function developmentSeedConfig(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production") throw new Error("Seed indisponível em produção.");
  const userId = env.SEED_USER_ID?.trim();
  if (!userId?.startsWith("user_")) throw new Error("Defina SEED_USER_ID com a conta Clerk de desenvolvimento.");
  const databaseUrl = env.SEED_DATABASE_URL;
  if (!databaseUrl) throw new Error("Defina SEED_DATABASE_URL para o PostgreSQL local de desenvolvimento.");
  const url = new URL(databaseUrl);
  if (!['postgresql:', 'postgres:'].includes(url.protocol)
    || url.hostname !== "127.0.0.1" || url.port !== "55440" || url.pathname !== "/scanteca_development") {
    throw new Error("Seed permitido apenas em 127.0.0.1:55440/scanteca_development.");
  }
  return { userId, databaseUrl };
}

export const developmentBooks = [
  { key: "finished", title: "O Jardim das Páginas", status: "READ", pages: 120, currentPage: 120, readCount: 1 },
  { key: "reading", title: "A Biblioteca das Nuvens", status: "READING", pages: 200, currentPage: 40, readCount: 0 },
  { key: "planned", title: "Cartas do Farol", status: "TO_READ", pages: 160, currentPage: 0, readCount: 0 },
  { key: "wishlist", title: "Atlas de Lugares Inventados", status: "WISHLIST", pages: 240, currentPage: 0, readCount: 0 },
] as const;

export function fixtureId(userId: string, key: string) {
  return `dev_fixture_${createHash("sha256").update(`${userId}:${key}`).digest("hex").slice(0, 32)}`;
}

/** Insert-only fixtures: rerunning preserves edits made while exercising the UI. */
export async function seedDevelopment(prisma: PrismaClient, userId: string, now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const today = new Date(`${day}T00:00:00.000Z`);
  const previousDay = new Date(today.getTime() - 86400000);
  const sessionStart = new Date(previousDay.getTime() + 15 * 3600000);
  const id = (key: string) => fixtureId(userId, key);

  return prisma.$transaction(async tx => {
    // Serialize simultaneous runs for this account, including date-unique logs.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`development-fixtures:${userId}`}))`;
    await tx.librarySetting.upsert({ where: { userId }, update: {}, create: { userId, name: "Biblioteca de desenvolvimento", yearlyGoal: 12 } });
    const collections = await Promise.all(["Ficção de teste", "Referência de teste"].map(name =>
      tx.collection.upsert({ where: { userId_name: { userId, name } }, update: {}, create: { userId, name } })));
    for (const book of developmentBooks) {
      await tx.book.upsert({
        where: { id: id(book.key) }, update: {},
        create: {
          id: id(book.key), userId, isbn: `DEV-FIXTURE-${book.key}`, title: book.title,
          author: "Autoria fictícia", synopsis: "Livro fictício para validação dos fluxos de desenvolvimento.",
          collectionId: collections[book.key === "wishlist" ? 1 : 0]!.id,
          status: book.status, pages: book.pages, currentPage: book.currentPage, readCount: book.readCount,
          startedAt: book.status === "READ" || book.status === "READING" ? sessionStart : null,
          finishedAt: book.status === "READ" ? sessionStart : null,
          rating: book.status === "READ" ? 4 : null,
          notes: "Nota privada fictícia: não deve aparecer no catálogo compartilhado.",
        },
      });
    }
    await tx.readingSession.upsert({
      where: { id: id("session") }, update: {},
      create: { id: id("session"), userId, bookId: id("reading"), startedPage: 0, currentPage: 40,
        startedAt: sessionStart, endedAt: new Date(sessionStart.getTime() + 1800000), durationSec: 1800 },
    });
    // Stable ID prevents a new log from being added every day the seed is run.
    const logExists = await tx.readingLog.findUnique({ where: { id: id("log") } });
    if (!logExists) await tx.readingLog.upsert({
      where: { userId_date: { userId, date: previousDay } }, update: {},
      create: { id: id("log"), userId, bookId: id("reading"), date: previousDay, pages: 40, note: "Atividade fictícia" },
    });
    await tx.diaryEntry.upsert({
      where: { id: id("diary") }, update: {},
      create: { id: id("diary"), userId, bookId: id("reading"), sessionId: id("session"), type: "REFLECTION",
        content: "Reflexão fictícia para testar edição e organização do diário.", page: 40, tags: ["desenvolvimento"], ragEnabled: false },
    });
    await tx.bookPassage.upsert({ where: { id: id("passage") }, update: {},
      create: { id: id("passage"), bookId: id("reading"), chapter: 1, paragraph: 1 } });
    await tx.annotation.upsert({ where: { id: id("annotation") }, update: {},
      create: { id: id("annotation"), userId, passageId: id("passage"), sessionId: id("session"), content: "Anotação fictícia para revisão visual.", type: "comment" } });
    return { books: developmentBooks.length, collections: collections.length };
  }, { timeout: 15000 });
}
