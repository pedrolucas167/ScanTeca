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
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

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

function questionRequest(question: string, signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/oracle", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }), signal,
  });
}

describe("Oracle actions and interrupted providers", () => {
  it("rejects unauthenticated requests before providers or persistence", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null } as Awaited<ReturnType<typeof auth>>);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const transaction = vi.mocked(prisma.$transaction);
    transaction.mockClear();
    expect((await POST(questionRequest("adicionar livro"))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });
  it("offers a confirmed navigation action without an AI key or database mutation", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.mocked(prisma.$transaction).mockClear();
    const response = await POST(questionRequest("adicionar livro"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"action":"add_book"');
    expect(fetch).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("reports provider unavailability without exposing configuration details", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const response = await POST(questionRequest("oi"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/OPENROUTER|\.env/);
  });
  it("rejects a truncated greeting response instead of emitting successful completion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"parcial"}}]}\n\n')));
    const response = await POST(questionRequest("oi"));
    await expect(response.text()).rejects.toThrow("concluir");
  });
  it("propagates downstream cancellation to the provider request and body", async () => {
    const cancel = vi.fn();
    let providerSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => {
      providerSignal = options.signal as AbortSignal;
      return new Response(new ReadableStream({ cancel }));
    }));
    const response = await POST(questionRequest("oi"));
    await response.body!.cancel();
    expect(providerSignal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
