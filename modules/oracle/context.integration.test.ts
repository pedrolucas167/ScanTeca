import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", async () => {
  const { createPrismaClient } = await import("@/lib/prisma-client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina o banco local isolado de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Banco de testes inválido.");
  return { prisma: createPrismaClient(raw) };
});
import { prisma } from "@/lib/prisma";
import { loadOracleContext, retrieveOracleMemories } from "./context";

const userId = "oracle-context-integration-owner";
const otherId = "oracle-context-integration-other";
const owners = { in: [userId, otherId] };
const embedding = [1, ...Array<number>(1535).fill(0)];
const vector = `[${embedding.join(",")}]`;
let sessionId: string;
let questionId: string;
let replacesId: string;
let priorId: string;

async function clean() {
  await prisma.oracleSession.deleteMany({ where: { userId: owners } });
  await prisma.book.deleteMany({ where: { userId: owners } });
  await prisma.collection.deleteMany({ where: { userId: owners } });
  await prisma.librarySetting.deleteMany({ where: { userId: owners } });
  await prisma.readingLog.deleteMany({ where: { userId: owners } });
  await prisma.externalResearchData.deleteMany({ where: { userId: owners } });
}

beforeAll(async () => {
  await clean();
  const books: Record<string, string> = {};
  for (const owner of [userId, otherId]) {
    const collection = await prisma.collection.create({ data: { userId: owner, name: "Fixture de contexto" } });
    const book = await prisma.book.create({ data: { userId: owner, collectionId: collection.id,
      isbn: "fixture", title: `Livro de ${owner}`, author: "Autor fictício", status: "READING", currentPage: 20, pages: 200 } });
    books[owner] = book.id;
    await prisma.librarySetting.create({ data: { userId: owner, oracleProfile: `Preferências de ${owner}` } });
    await prisma.readingLog.create({ data: { userId: owner, date: new Date(), pages: owner === userId ? 10 : 90 } });
    await prisma.diaryEntry.create({ data: { userId: owner, bookId: book.id, content: `Diário de ${owner}` } });
    await prisma.review.create({ data: { userId: owner, bookId: book.id, content: `Avaliação de ${owner}`, rating: 4 } });
    await prisma.externalResearchData.create({ data: { userId: owner, source: "fixture", url: "https://example.invalid",
      title: `Pesquisa de ${owner}`, type: "article", content: "Pesquisa fictícia" } });
    const session = await prisma.oracleSession.create({ data: { userId: owner, title: "Conversa fictícia" } });
    await prisma.oracleMessage.create({ data: { userId: owner, sessionId: session.id, role: "user", content: "Pergunta anterior" } });
    if (owner === userId) {
      sessionId = session.id;
      priorId = (await prisma.oracleMessage.findFirstOrThrow({ where: { sessionId } })).id;
      replacesId = (await prisma.oracleMessage.create({ data: { userId, sessionId, role: "assistant",
        content: "Resposta anterior suficientemente longa para regenerar." } })).id;
      questionId = (await prisma.oracleMessage.create({ data: { userId, sessionId, role: "user", content: "Pergunta atual" } })).id;
    }
  }
  const ownBookId = books[userId];
  const otherBookId = books[otherId];
  if (!ownBookId || !otherBookId) throw new Error("Fixture sem os livros dos dois leitores.");
  await prisma.diaryEntry.createMany({ data: [
    { userId, bookId: ownBookId, content: "Diário desabilitado", ragEnabled: false },
    { userId, bookId: otherBookId, content: "Vínculo inconsistente com livro alheio" },
    { userId: otherId, bookId: ownBookId, content: "Entrada alheia em livro próprio" },
  ] });
  await prisma.review.createMany({ data: [
    { userId, bookId: otherBookId, content: "Avaliação com livro alheio" },
    { userId: otherId, bookId: ownBookId, content: "Avaliação alheia em livro próprio" },
  ] });
  await prisma.$executeRaw`UPDATE "Book" SET embedding = ${vector}::vector WHERE "userId" IN (${userId}, ${otherId})`;
  await prisma.$executeRaw`UPDATE "DiaryEntry" SET embedding = ${vector}::vector WHERE "userId" IN (${userId}, ${otherId})`;
  await prisma.$executeRaw`UPDATE "Review" SET embedding = ${vector}::vector WHERE "userId" IN (${userId}, ${otherId})`;
  await prisma.$executeRaw`UPDATE "ExternalResearchData" SET embedding = ${vector}::vector WHERE "userId" IN (${userId}, ${otherId})`;
});
afterAll(async () => { await clean(); await prisma.$disconnect(); });
const input = () => ({ userId, sessionId, question: "Pergunta atual", currentRequestMessageId: questionId,
  replacesId, signal: new AbortController().signal });

describe("Oracle context isolation in PostgreSQL and pgvector", () => {
  it("loads only the reader's conversation, preferences, progress and recent activity", async () => {
    const context = await loadOracleContext(input());
    expect(context.conversationHistory.map(message => message.id)).toEqual([priorId]);
    expect(context.setting?.oracleProfile).toBe(`Preferências de ${userId}`);
    expect(context.readingNow.map(book => book.title)).toEqual([`Livro de ${userId}`]);
    expect(context.weekLogs.map(log => log.pages)).toEqual([10]);
  });
  it("excludes disabled diaries and entries whose owner differs from the book", async () => {
    const context = await loadOracleContext(input());
    expect(context.diaryEntries.map(entry => entry.content)).toEqual([`Diário de ${userId}`]);
  });
  it.each([userId, otherId])("scopes every semantic source to %s and its owned book", async owner => {
    const memories = await retrieveOracleMemories(owner, embedding, input().signal);
    expect(memories.similarBooks.map(book => book.title)).toEqual([`Livro de ${owner}`]);
    expect(memories.semanticDiary.map(entry => entry.content)).toEqual([`Diário de ${owner}`]);
    expect(memories.semanticReviews.map(entry => entry.content)).toEqual([`Avaliação de ${owner}`]);
    expect(memories.semanticExternal.map(entry => entry.title)).toEqual([`Pesquisa de ${owner}`]);
    expect(Number(memories.similarBooks[0]?.distance)).toBeCloseTo(0);
  });
});
