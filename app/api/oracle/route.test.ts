import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, after } from "next/server";
vi.mock("next/server", async importOriginal => ({ ...await importOriginal<typeof import("next/server")>(), after: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn().mockResolvedValue({ userId: "test-owner" }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn().mockResolvedValue(null), rateLimits: {} }));
vi.mock("@/lib/embeddings", () => ({ generateEmbedding: vi.fn().mockResolvedValue([0.1]) }));
vi.mock("@/modules/oracle/history", () => ({ saveOracleAnswer: vi.fn().mockResolvedValue({ id: "answer" }),
  getOracleRegenerationTarget: vi.fn().mockResolvedValue(null) }));
vi.mock("@/modules/oracle/retrieval", async original => ({ ...await original<typeof import("@/modules/oracle/retrieval")>(),
  retrieveBooks: vi.fn().mockResolvedValue({ books: [], metadataCandidates: 0, lexicalCandidates: 0 }) }));
vi.mock("@/modules/oracle/profile", () => ({ updateReaderProfile: vi.fn().mockResolvedValue(undefined) }));
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

  it("usa somente o S5-free em produção quando configurado, mantendo as fontes do acervo", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
    vi.stubEnv("MARITACA_API_KEY", "");
    vi.stubEnv("key_maritaca_ai", "fixture-maritaca");
    vi.mocked(generateEmbedding).mockClear();
    vi.mocked(retrieval.retrieveBooks).mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response('data: {"choices":[{"delta":{"content":"Duna aborda ecologia [1]."}}]}\n\ndata: [DONE]\n\n'));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(questionRequest("Quais temas aparecem em Duna?"));
    expect(await response.text()).toContain("Duna aborda ecologia [1].");
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://chat.maritaca.ai/api/chat/completions");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer fixture-maritaca" });
    const providerBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(providerBody).toMatchObject({ model: "S5-free", stream: true });
    expect(providerBody).not.toHaveProperty("temperature");
  });

  it("responde sobre autoria com acervo vazio, sem apresentar a resposta como evidência do acervo", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
    vi.stubEnv("MARITACA_API_KEY", "fixture-maritaca");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response('data: {"choices":[{"delta":{"content":"O Tambor foi escrito por Günter Grass."}}]}\n\ndata: [DONE]\n\n'));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(questionRequest("Quem escreveu O Tambor?"));
    const body = await response.text();
    expect(body).toContain("Conhecimento geral");
    expect(body).toContain("Günter Grass");
    expect(body).toContain('"sources":[]');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(["valid", "citation", "inventory", "inventory-exhaustive"])("checks the grounded response before persistence (%s)", async kind => {
    vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const invalid = kind !== "valid";
    vi.mocked(retrieval.retrieveBooks).mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    vi.mocked(generateEmbedding).mockResolvedValueOnce(null);
    vi.mocked(saveOracleAnswer).mockClear();
    let prompt = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => {
      prompt = String(options.body);
      const text = kind === "inventory" ? "Em seu acervo pessoal, não há um livro que trate de navegação por rios [1]."
        : kind === "inventory-exhaustive" ? "O único livro de ficção científica que consta é Duna [1]."
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
    vi.mocked(retrieval.retrieveBooks).mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
    const learn = vi.mocked(retrieval.updateReaderProfile).mockResolvedValue(undefined);
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
    vi.mocked(retrieval.retrieveBooks).mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
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
    vi.mocked(retrieval.retrieveBooks).mockResolvedValueOnce({ books: [book], metadataCandidates: 0, lexicalCandidates: 1 });
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

function questionRequest(question: string, signal?: AbortSignal, scope = "library") {
  return new NextRequest("http://localhost/api/oracle", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, scope }), signal,
  });
}

describe("explicit Google Books search", () => {
  beforeEach(() => {
    vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
    vi.stubEnv("MARITACA_API_KEY", "fixture-maritaca");
    vi.stubEnv("GOOGLE_BOOKS_API_KEY", "fixture-google");
  });

  it.each([
    ["Pesquise na internet ISBN 9780141439518", "isbn:9780141439518"],
    ['Busque no Google Books autor: "Jane Austen"', 'inauthor:"Jane Austen"'],
    ['Consulte no catálogo externo edições: “Pride and Prejudice”', 'intitle:"Pride and Prejudice"'],
  ])("streams linkable evidence for %s", async (question, query) => {
    vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn<typeof fetch>(async (input, options) => {
      const url = new URL(String(input));
      if (url.hostname === "www.googleapis.com") {
        expect(url.pathname).toBe("/books/v1/volumes");
        expect(url.searchParams.get("q")).toBe(query);
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        return Response.json({ items: [{ id: "test-volume", volumeInfo: {
          title: "Pride and Prejudice", authors: ["Jane Austen"], publisher: "Penguin",
          publishedDate: "2003", industryIdentifiers: [{ type: "ISBN_13", identifier: "9780141439518" }],
        } }] });
      }
      expect(url.hostname).toBe("chat.maritaca.ai");
      const payload = JSON.parse(String(options?.body));
      expect(payload).toMatchObject({ model: "S5-free", stream: true });
      expect(payload.messages[1].content).toContain("[1] Pride and Prejudice — Jane Austen");
      expect(payload.messages[1].content).toContain("ISBN-13: 9780141439518");
      return new Response('data: {"choices":[{"delta":{"content":"Jane Austen é a autora [1]."}}]}\n\ndata: [DONE]\n\n');
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(questionRequest(question));
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const body = await response.text();
    expect(body).toContain('"stage":"external"');
    expect(body).toContain('"url":"https://books.google.com/books?id=test-volume"');
    expect(body).toContain('"citations":[1]');
    expect(body).toContain("data: [DONE]");
    expect(body).not.toContain("fixture-google");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith("oracle-performance", expect.objectContaining({
      outcome: "completed", stages: expect.objectContaining({ external: expect.any(Number), generation: expect.any(Number) }),
    }));
  });

  it("does not send conversational context to Google even with expanded scope", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response('data: {"choices":[{"delta":{"content":"Orgulho e Preconceito foi escrito por Jane Austen."}}]}\n\ndata: [DONE]\n\n'));
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await POST(questionRequest("Quem escreveu Orgulho e Preconceito?", undefined, "all"))).text();
    expect(body).toContain("Conhecimento geral");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://chat.maritaca.ai/api/chat/completions");
  });

  it("rejects extra private context after a bibliographic field without making provider requests", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await POST(questionRequest(
      'Pesquise na internet autor: "Jane Austen". Meu diário é privado.',
    ))).text();
    expect(body).toContain("Para consultar o Google Books");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([429, 200])("reports a provider response with no evidence (%s)", async status => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ items: [] }, { status }));
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await POST(questionRequest("Pesquise na internet ISBN 9780141439518"))).text();
    expect(body).toContain(status === 200 ? "Não encontrei registros correspondentes" : "Não consegui consultar");
    expect(body).toContain('"sources":[]');
    expect(body).toContain("data: [DONE]");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("explicit Brave LLM Context search", () => {
  beforeEach(() => {
    vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
    vi.stubEnv("MARITACA_API_KEY", "fixture-maritaca");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    vi.stubEnv("key_brave_api", "fixture-brave");
  });

  const question = 'Pesquise na web: "Octavia Butler Kindred interview"';

  it("calls Brave once with the delimited terms and streams cited evidence", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, options) => {
      const url = new URL(String(input));
      if (url.hostname === "api.search.brave.com") {
        expect(url.pathname).toBe("/res/v1/llm/context");
        expect(url.searchParams.get("q")).toBe("Octavia Butler Kindred interview");
        expect(url.searchParams.get("maximum_number_of_tokens")).toBe("2048");
        expect(options?.headers).toMatchObject({ "X-Subscription-Token": "fixture-brave" });
        expect(options?.redirect).toBe("error");
        return Response.json({ grounding: { generic: [
          { url: "javascript:alert(1)", snippets: ["Unsafe source"] },
          { url: "https://example.org/interview", title: "Interview", snippets: ["Butler researched slave narratives for Kindred."] },
          { url: "https://example.org/interview#duplicate", snippets: ["Duplicate"] },
        ] } });
      }
      expect(url.hostname).toBe("chat.maritaca.ai");
      const payload = JSON.parse(String(options?.body));
      expect(payload).toMatchObject({ model: "S5-free", stream: true });
      expect(payload.messages[1].content).toContain('Butler researched slave narratives for Kindred.');
      expect(payload.messages[1].content).not.toMatch(/Unsafe source|Duplicate|fixture-brave/);
      return new Response('data: {"choices":[{"delta":{"content":"Butler pesquisou relatos de pessoas escravizadas para escrever Kindred [1]."}}]}\n\ndata: [DONE]\n\n');
    });
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await POST(questionRequest(question))).text();
    expect(body).toContain('"url":"https://example.org/interview"');
    expect(body).toContain('"citations":[1]');
    expect(body).toContain("data: [DONE]");
    expect(body).not.toMatch(/javascript:|fixture-brave/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([429, 200])("reports unavailable or empty Brave evidence (%s)", async status => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ grounding: { generic: [] } }, { status }));
    vi.stubGlobal("fetch", fetchMock);
    const body = await (await POST(questionRequest(question))).text();
    expect(body).toContain(status === 200 ? "Não encontrei fontes relevantes" : "Não consegui consultar o Brave Search");
    expect(body).toContain("data: [DONE]");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("makes no outbound request if the key is missing or extra text follows the query", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await POST(questionRequest(question + " Veja também meu diário."))).text()).toContain("termos públicos da busca");
    vi.stubEnv("key_brave_api", "");
    expect(await (await POST(questionRequest(question))).text()).toContain("ainda não foi configurada");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

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
