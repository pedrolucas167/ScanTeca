import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {
  oracleMessage: { findMany: vi.fn() }, librarySetting: { findUnique: vi.fn() },
  book: { findMany: vi.fn() }, readingLog: { findMany: vi.fn() }, diaryEntry: { findMany: vi.fn() }, $queryRaw: vi.fn(),
} }));
import { prisma } from "@/lib/prisma";
import { loadOracleContext, retrieveOracleMemories } from "./context";

const input = () => ({ userId: "owner", sessionId: "session", question: "Quero outra indicação",
  currentRequestMessageId: "current" as string | null, signal: new AbortController().signal });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.oracleMessage.findMany).mockResolvedValue([]);
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.book.findMany).mockResolvedValue([]);
  vi.mocked(prisma.readingLog.findMany).mockResolvedValue([]);
  vi.mocked(prisma.diaryEntry.findMany).mockResolvedValue([]);
});

describe("Oracle context failures and history", () => {
  it("omits the persisted question and corrupted answers without mutating history", async () => {
    const history = [
      { id: "current", role: "user", content: input().question },
      { id: "bad", role: "assistant", content: "undefined" },
      { id: "good", role: "assistant", content: "Uma resposta anterior suficientemente longa e válida." },
      { id: "prior", role: "user", content: "Qual livro?" },
    ];
    vi.mocked(prisma.oracleMessage.findMany).mockResolvedValue(history as never);
    const result = await loadOracleContext(input());
    expect(result.conversationHistory.map(message => message.id)).toEqual(["good", "prior"]);
    expect(history).toHaveLength(4);
  });
  it("omits the latest unanswered question on retry without removing earlier equal questions", async () => {
    vi.mocked(prisma.oracleMessage.findMany).mockResolvedValue([
      { id: "latest", role: "user", content: input().question },
      { id: "earlier", role: "user", content: input().question },
    ] as never);
    expect((await loadOracleContext({ ...input(), currentRequestMessageId: null })).conversationHistory.map(m => m.id)).toEqual(["earlier"]);
  });
  it("propagates a failed context read instead of generating from an incomplete snapshot", async () => {
    vi.mocked(prisma.librarySetting.findUnique).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(loadOracleContext(input())).rejects.toThrow("database unavailable");
  });
  it("does not start database work for an already cancelled request", async () => {
    const signal = AbortSignal.abort();
    await expect(loadOracleContext({ ...input(), signal })).rejects.toThrow();
    await expect(retrieveOracleMemories("owner", [1], signal)).rejects.toThrow();
    expect(prisma.oracleMessage.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it("discards context that completes after cancellation", async () => {
    const cancelled = new AbortController();
    const loading = loadOracleContext({ ...input(), signal: cancelled.signal });
    cancelled.abort();
    await expect(loading).rejects.toThrow();
  });
  it("skips vector SQL when embedding is unavailable", async () => {
    expect(await retrieveOracleMemories("owner", null, input().signal)).toEqual({
      similarBooks: [], semanticDiary: [], semanticReviews: [], semanticExternal: [],
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it("propagates a vector query failure instead of treating it as empty evidence", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("vector query failed"));
    await expect(retrieveOracleMemories("owner", [1], input().signal)).rejects.toThrow("vector query failed");
  });
});
