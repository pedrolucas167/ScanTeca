import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", async () => {
  const { createPrismaClient } = await import("@/lib/prisma-client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina o banco local isolado de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Banco de testes inválido.");
  return { prisma: createPrismaClient(raw) };
});
import { prisma } from "@/lib/prisma";
import { prepareOracleSession } from "./session";

const userId = "oracle-session-integration-owner";
const otherId = "oracle-session-integration-other";
const input = () => ({ userId, question: "Quais livros de astronomia posso ler?", mode: "EXPLORE" as const });
beforeEach(async () => {
  await prisma.oracleSession.deleteMany({ where: { userId: { in: [userId, otherId] } } });
});
afterAll(() => prisma.$disconnect());

describe("Oracle session preparation in PostgreSQL", () => {
  it("creates the conversation and its question together", async () => {
    const result = await prepareOracleSession({ ...input(), question: "a".repeat(100), requestId: "request-1" });
    expect(await prisma.oracleSession.findUnique({ where: { id: result.sessionId } })).toMatchObject({
      userId, title: "a".repeat(80), mode: "EXPLORE",
    });
    expect(await prisma.oracleMessage.findUnique({ where: { id: result.currentRequestMessageId! } })).toMatchObject({
      sessionId: result.sessionId, userId, role: "user", content: "a".repeat(100), requestId: "request-1",
    });
  });
  it("appends to an owned conversation without creating another session", async () => {
    const first = await prepareOracleSession(input());
    const next = await prepareOracleSession({ ...input(), sessionId: first.sessionId });
    expect(next.sessionId).toBe(first.sessionId);
    expect(await prisma.oracleSession.count({ where: { userId } })).toBe(1);
    expect(await prisma.oracleMessage.count({ where: { sessionId: first.sessionId } })).toBe(2);
  });
  it("does not duplicate a question during regeneration", async () => {
    const first = await prepareOracleSession(input());
    const retry = await prepareOracleSession({ ...input(), sessionId: first.sessionId, regenerate: true });
    expect(retry).toEqual({ sessionId: first.sessionId, currentRequestMessageId: null });
    expect(await prisma.oracleMessage.count({ where: { sessionId: first.sessionId } })).toBe(1);
  });
  it.each(["another-owner", "missing"])("rejects a %s conversation without writing a question", async kind => {
    const foreign = await prepareOracleSession({ ...input(), userId: otherId });
    const sessionId = kind === "missing" ? "nonexistent-session" : foreign.sessionId;
    await expect(prepareOracleSession({ ...input(), sessionId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.oracleMessage.count({ where: { userId } })).toBe(0);
    expect(await prisma.oracleMessage.count({ where: { userId: otherId } })).toBe(1);
  });
  it("rolls back the new session when a repeated request cannot insert its question", async () => {
    await prepareOracleSession({ ...input(), requestId: "repeat" });
    await expect(prepareOracleSession({ ...input(), requestId: "repeat" })).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
    expect(await prisma.oracleSession.count({ where: { userId } })).toBe(1);
    expect(await prisma.oracleMessage.count({ where: { userId } })).toBe(1);
  });
  it("scopes request identifiers to the reader", async () => {
    await prepareOracleSession({ ...input(), requestId: "same" });
    await expect(prepareOracleSession({ ...input(), userId: otherId, requestId: "same" })).resolves.toHaveProperty("currentRequestMessageId");
  });
});
