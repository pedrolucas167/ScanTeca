import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, after } from "next/server";
vi.mock("next/server", async importOriginal => ({ ...await importOriginal<typeof import("next/server")>(), after: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn().mockResolvedValue({ userId: "test-owner" }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn().mockResolvedValue(null), rateLimits: {} }));
vi.mock("@/lib/embeddings", () => ({ generateEmbedding: vi.fn().mockResolvedValue([0.1]) }));
vi.mock("@/modules/oracle/history", () => ({ saveOracleAnswer: vi.fn().mockResolvedValue({ id: "answer" }),
  getOracleRegenerationTarget: vi.fn().mockResolvedValue(null) }));
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
import { saveOracleAnswer } from "@/modules/oracle";
import { generateEmbedding } from "@/lib/embeddings";
import * as retrieval from "@/modules/oracle";

beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "test-key"); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
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

describe("grounded answers and evidence", () => {
  const book = { id: "dune", title: "Duna", author: "Frank Herbert", publishedDate: "1965",
    genre: "Ficção Científica", status: "TO_READ", rating: null, synopsis: "Ecologia em um planeta desértico" };

  it.each(["valid", "citation", "inventory"])("checks the grounded response before persistence (%s)", async kind => {
    vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const invalid = kind !== "valid";
    vi.spyOn(retrieval, "retrieveBooks").mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    vi.mocked(generateEmbedding).mockResolvedValueOnce(null);
    vi.mocked(saveOracleAnswer).mockClear();
    let prompt = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => {
      prompt = String(options.body);
      const text = kind === "inventory" ? "Em seu acervo pessoal, não há um livro que trate de navegação por rios [1]."
        : `Duna aborda ecologia em um planeta desértico [${invalid ? 2 : 1}].`;
      return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: {"choices":[],"usage":{"prompt_tokens":42,"completion_tokens":5,"cost":0.0002}}\n\ndata: [DONE]\n\n`);
    }));
    const response = await POST(questionRequest("Quais temas aparecem em Duna?"));
    const body = await response.text();
    expect(prompt).toContain('[1]');
    expect(body).toContain('"id":"dune"');
    expect(body).toContain('"embeddingAvailable":false');
    expect(body).not.toMatch(/inputTokens|costUsd|prompt_tokens/);
    expect(info).toHaveBeenCalledWith("oracle-performance", expect.objectContaining({
      outcome: invalid ? "rejected" : "completed",
      usage: { generation: { inputTokens: 42, outputTokens: 5, costUsd: 0.0002 } },
    }));
    if (invalid) {
      expect(body).toContain("Não consegui gerar uma resposta confiável");
      expect(saveOracleAnswer).not.toHaveBeenCalled();
    } else {
      expect(body).toContain('"citations":[1]');
      expect(saveOracleAnswer).toHaveBeenCalledWith(expect.objectContaining({ sources: [expect.objectContaining({ id: "dune" })] }));
    }
  });

  it("returns accepted-session progress before context finishes and cancels pending retrieval", async () => {
    const gate = Promise.withResolvers<never[]>();
    vi.mocked(prisma.oracleMessage.findMany).mockReturnValueOnce(gate.promise as never);
    vi.mocked(generateEmbedding).mockClear();
    const response = await POST(questionRequest("Quais temas aparecem em Duna?"));
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"sessionId":');
    expect(generateEmbedding).not.toHaveBeenCalled();
    await reader.cancel();
    gate.resolve([]);
    await Promise.resolve();
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("learns preferences only through the post-response callback", async () => {
    const history = Array.from({ length: 4 }, (_, index) => ({ id: `old-${index}`, role: "user", content: "Prefiro histórias curtas sobre natureza" }));
    vi.mocked(prisma.oracleMessage.findMany).mockResolvedValueOnce(history as never);
    vi.spyOn(retrieval, "retrieveBooks").mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    const learn = vi.spyOn(retrieval, "updateReaderProfile").mockResolvedValue(undefined);
    vi.mocked(after).mockClear();
    vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => {
      if (!JSON.parse(String(options.body)).stream) return Response.json({ choices: [{ message: { content: "Temas de Duna" } }] });
      return new Response('data: {"choices":[{"delta":{"content":"Duna aborda ecologia em um planeta desértico [1]."}}]}\n\ndata: [DONE]\n\n');
    }));
    const body = await (await POST(questionRequest("Quais temas aparecem em Duna?"))).text();
    expect(body).toContain("data: [DONE]");
    expect(learn).not.toHaveBeenCalled();
    const callback = vi.mocked(after).mock.calls[0]?.[0];
    expect(typeof callback).toBe("function");
    if (typeof callback === "function") await callback();
    expect(learn).toHaveBeenCalledWith(expect.objectContaining({ userId: "test-owner", question: "Quais temas aparecem em Duna?" }));
  });

  it("reports a post-start provider failure through a safe SSE error", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(retrieval, "retrieveBooks").mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    vi.mocked(saveOracleAnswer).mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "private provider detail" }, { status: 502 })));
    const response = await POST(questionRequest("Quais temas aparecem em Duna?"));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"error":');
    expect(body).not.toMatch(/private|\[DONE\]/);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("private");
    expect(saveOracleAnswer).not.toHaveBeenCalled();
  });

  it("uses identical references for book, diary, review and external research in the actual route", async () => {
    vi.spyOn(retrieval, "retrieveBooks").mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "diary", bookTitle: "Duna", bookAuthor: "Herbert", type: "NOTE", page: 20, content: "Minha anotação", distance: 0.2 }])
      .mockResolvedValueOnce([{ id: "review", bookTitle: "Duna", bookAuthor: "Herbert", rating: 4, content: "Minha avaliação", distance: 0.2 }])
      .mockResolvedValueOnce([{ id: "research", title: "Pesquisa", source: "Wikipedia", type: "article", content: "Pesquisa registrada", distance: 0.2 }]);
    let prompt = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => {
      prompt = JSON.parse(String(options.body)).messages.at(-1).content;
      return new Response('data: {"choices":[{"delta":{"content":"As fontes consultadas são [1], [2], [3] e [4]."}}]}\n\ndata: [DONE]\n\n');
    }));
    const body = await (await POST(questionRequest("Quais temas aparecem em Duna?"))).text();
    const events = body.split("\n\n").filter(line => line.startsWith("data: {")).map(line => JSON.parse(line.slice(6)));
    expect(events.find(event => event.sources).sources.map((source: { id: string }) => source.id)).toEqual(["dune", "diary", "review", "research"]);
    expect(prompt).toContain('[1] "Duna"');
    expect(prompt).toContain('[2] - [NOTE]');
    expect(prompt).toContain('[3] - "Duna"');
    expect(prompt).toContain('[4] - [Wikipedia');
  });
});

function questionRequest(question: string, signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/oracle", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }), signal,
  });
}

describe("Oracle actions and interrupted providers", () => {
  it.each([
    ["NOT_FOUND", 404], ["DUPLICATE_REQUEST", 409],
  ] as const)("returns %s before starting providers or SSE", async (code, status) => {
    vi.spyOn(retrieval, "prepareOracleSession").mockRejectedValueOnce(new retrieval.OracleSessionError(code));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.mocked(after).mockClear();
    const response = await POST(questionRequest("Quais livros sobre astronomia posso ler?"));
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(fetch).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });
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
