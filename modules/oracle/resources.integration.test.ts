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
import { createOracleSession, listOracleSessions, findOracleSession, updateOracleSession, deleteOracleSession } from "./session";
import { saveOracleArtifact, listOracleArtifacts } from "./artifacts";
import { getOracleHome, clearOracleHistory } from "./home";

const userId = "oracle-resources-integration-owner";
const otherId = "oracle-resources-integration-other";
let sessionId: string;
const artifact = () => ({ type: "NOTE" as const, title: "Nota fictícia", content: "Conteúdo fictício", sessionId });
beforeEach(async () => {
  const owners = { in: [userId, otherId] };
  await prisma.oracleArtifact.deleteMany({ where: { userId: owners } });
  await prisma.oracleSession.deleteMany({ where: { userId: owners } });
  sessionId = (await createOracleSession(userId, { title: "Conversa própria", mode: "EXPLORE" })).id;
  await createOracleSession(otherId, { title: "Conversa alheia", mode: "EXPLORE" });
});
afterAll(() => prisma.$disconnect());

describe("Oracle resource ownership and lifecycle in PostgreSQL", () => {
  it("lists only the authenticated reader's sessions", async () => {
    expect((await listOracleSessions(userId)).map(session => session.title)).toEqual(["Conversa própria"]);
  });
  it("permits owned changes and refuses foreign reads, updates and deletion", async () => {
    expect(await updateOracleSession(userId, sessionId, { title: "Renomeada" })).toBe(true);
    expect(await findOracleSession(userId, sessionId)).toMatchObject({ title: "Renomeada" });
    expect(await findOracleSession(otherId, sessionId)).toBeNull();
    expect(await updateOracleSession(otherId, sessionId, { title: "Invasão" })).toBe(false);
    expect(await deleteOracleSession(otherId, sessionId)).toBe(false);
    expect(await findOracleSession(userId, sessionId)).toMatchObject({ title: "Renomeada" });
  });
  it("rejects linking an artifact to another reader's session without writing", async () => {
    await expect(saveOracleArtifact(otherId, artifact())).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.oracleArtifact.count({ where: { userId: otherId } })).toBe(0);
  });
  it("saves owned and unlinked artifacts while isolating their lists", async () => {
    const linked = await saveOracleArtifact(userId, artifact());
    await saveOracleArtifact(otherId, { ...artifact(), sessionId: null });
    expect((await listOracleArtifacts(userId)).map(item => item.id)).toEqual([linked.id]);
    expect((await findOracleSession(userId, sessionId))?.artifacts.map(item => item.id)).toEqual([linked.id]);
  });
  it("deletes the conversation and messages but retains its detached artifact", async () => {
    await prisma.oracleMessage.create({ data: { userId, sessionId, role: "user", content: "Pergunta" } });
    const saved = await saveOracleArtifact(userId, artifact());
    expect(await deleteOracleSession(userId, sessionId)).toBe(true);
    expect(await prisma.oracleMessage.count({ where: { sessionId } })).toBe(0);
    expect(await prisma.oracleArtifact.findUnique({ where: { id: saved.id } })).toMatchObject({ userId, sessionId: null });
    expect(await listOracleSessions(otherId)).toHaveLength(1);
  });
  it("does not expose inconsistent nested records owned by another reader", async () => {
    await prisma.oracleMessage.create({ data: { userId: otherId, sessionId, role: "assistant", content: "Registro inconsistente" } });
    await prisma.oracleArtifact.create({ data: { ...artifact(), userId: otherId } });
    const session = await findOracleSession(userId, sessionId);
    expect(session?.messages).toEqual([]);
    expect(session?.artifacts).toEqual([]);
    expect((await listOracleSessions(userId))[0]?._count).toEqual({ messages: 0, artifacts: 0 });
  });
  it("loads home history only from an owned session", async () => {
    await prisma.oracleMessage.create({ data: { userId, sessionId, role: "user", content: "Pergunta própria" } });
    const home = await getOracleHome(userId, sessionId);
    expect(home.messages.map(message => message.content)).toEqual(["Pergunta própria"]);
    expect(home.stats).toEqual({ total: 0, indexed: 0 });
    expect(home.sessions.map(session => session.userId)).toEqual([userId]);
    await expect(getOracleHome(otherId, sessionId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("clears only the reader's messages while preserving sessions and artifacts", async () => {
    const otherSession = (await listOracleSessions(otherId))[0]!;
    await prisma.oracleMessage.createMany({ data: [
      { userId, sessionId, role: "user", content: "Própria" },
      { userId: otherId, sessionId: otherSession.id, role: "user", content: "Alheia" },
    ] });
    const saved = await saveOracleArtifact(userId, artifact());
    await clearOracleHistory(userId);
    expect(await prisma.oracleMessage.count({ where: { userId } })).toBe(0);
    expect(await prisma.oracleMessage.count({ where: { userId: otherId } })).toBe(1);
    expect(await findOracleSession(userId, sessionId)).not.toBeNull();
    expect((await listOracleArtifacts(userId)).map(item => item.id)).toEqual([saved.id]);
  });
});
