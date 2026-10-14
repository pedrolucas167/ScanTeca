import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn().mockResolvedValue({ userId: "test-owner" }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn().mockResolvedValue(null), rateLimits: {} }));
vi.mock("@/lib/embeddings", () => ({ generateEmbedding: vi.fn().mockResolvedValue([0.1]) }));
vi.mock("@/lib/prisma", () => {
  const model = { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: "cm123456789012345678901234" }), count: vi.fn().mockResolvedValue(1) };
  const db = { oracleSession: model, oracleMessage: model, librarySetting: model, book: model,
    readingLog: model, diaryEntry: model, $queryRaw: vi.fn().mockResolvedValue([]) };
  return { prisma: { ...db, $transaction: vi.fn(async (fn) => fn(db)) } };
});
import { POST } from "./route";

beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "test-key"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("audio transcription in every Oracle response path", () => {
  it.each([
    ["Oi, tudo bem?", "chat"],
    ["Quero adicionar um livro", "tool"],
    ["Astronomia e estrelas distantes", "fallback"],
  ])("returns the transcript before the %s response", async (transcript) => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/audio/transcriptions")) return Response.json({ text: transcript });
      return new Response('data: {"choices":[{"delta":{"content":"Resposta de teste"}}]}\n\ndata: [DONE]\n\n');
    }));
    const res = await POST(new NextRequest("http://localhost/api/oracle", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ audio: { data: "ZmljdGljaW8=", format: "webm" } }),
    }));
    expect(res.status).toBe(200);
    const body = await res.text();
    const transcriptEvent = `data: ${JSON.stringify({ transcript })}`;
    expect(body).toContain(transcriptEvent);
    expect(body.indexOf(transcriptEvent)).toBeLessThan(body.indexOf('data: {"text":'));
    expect(body).toContain("data: [DONE]");
  });
});
