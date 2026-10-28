import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", async () => {
  const { createPrismaClient } = await import("@/lib/prisma-client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina SCANTECA_TEST_DATABASE_URL para a base local isolada de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") {
    throw new Error("Integração só aceita a base local scanteca_reading_test na porta 55439.");
  }
  return { prisma: createPrismaClient(raw) };
});

import { prisma } from "@/lib/prisma";
import { saveOracleAnswer } from "./history";
const userId = "oracle-integration-owner";
let sessionId: string;
let replacesId: string;
beforeEach(async () => {
  await prisma.oracleSession.deleteMany({ where: { userId } });
  const session = await prisma.oracleSession.create({ data: { userId, title: "Teste", mode: "EXPLORE" } });
  sessionId = session.id;
  const answer = await prisma.oracleMessage.create({ data: { userId, sessionId, role: "assistant", content: "Resposta anterior" } });
  replacesId = answer.id;
});
afterAll(() => prisma.$disconnect());
const input = () => ({ userId, sessionId, replacesId, mode: "EXPLORE", content: "Nova resposta", sources: [] });
describe("Oracle history in PostgreSQL", () => {
  it("replaces an answer atomically", async () => {
    await saveOracleAnswer(input());
    expect(await prisma.oracleMessage.findMany({where:{sessionId}})).toMatchObject([{content:"Nova resposta"}]);
  });
  it("blocks another account without removing the answer", async () => {
    await expect(saveOracleAnswer({...input(), userId:"oracle-integration-other"})).rejects.toThrow("Conversa");
    expect(await prisma.oracleMessage.findUnique({where:{id:replacesId}})).not.toBeNull();
  });
  it("rolls back deletion if inserting the replacement fails", async () => {
    await expect(saveOracleAnswer({...input(), content: null as unknown as string})).rejects.toThrow();
    expect(await prisma.oracleMessage.findUnique({where:{id:replacesId}})).toMatchObject({content:"Resposta anterior"});
  });
  it("allows only one concurrent replacement of the same answer", async () => {
    const results=await Promise.allSettled([saveOracleAnswer(input()),saveOracleAnswer(input())]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(await prisma.oracleMessage.count({where:{sessionId}})).toBe(1);
  });
});
