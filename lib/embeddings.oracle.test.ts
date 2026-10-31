import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
import { fetchWithTimeout } from "./fetch-with-timeout";
import { generateEmbedding } from "./embeddings";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("OPENROUTER_API_KEY", "fixture"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Oracle embedding cancellation and usage", () => {
  it("passes the abort signal and reports only returned usage", async () => {
    const embedding = Array<number>(1536).fill(0.1);
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ data: [{ embedding }], usage: { prompt_tokens: 12 } }));
    const signal = new AbortController().signal;
    const onUsage = vi.fn();
    expect(await generateEmbedding("Pergunta fictícia", { signal, onUsage })).toEqual(embedding);
    expect(fetchWithTimeout).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal }));
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens: 12, outputTokens: null, costUsd: null });
  });
  it("does not call the provider if the request is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await generateEmbedding("Pergunta fictícia", { signal: controller.signal })).toBeNull();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
  it.each([
    [0.1], Array<number>(1535).fill(0.1), Array<number>(1537).fill(0.1),
    Array<string>(1536).fill("0.1"), Array<number>(1536).fill(0),
    [null, ...Array<number>(1535).fill(0.1)],
  ])("falls back when the provider returns an unusable vector (%#)", async (...embedding) => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ data: [{ embedding }] }));
    expect(await generateEmbedding("Pergunta fictícia")).toBeNull();
  });
  it("does not log the provider response or parser error on malformed JSON", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response("resposta confidencial fictícia", { status: 200 }));
    expect(await generateEmbedding("Pergunta fictícia")).toBeNull();
    expect(error).toHaveBeenCalledExactlyOnceWith("[embeddings] Não foi possível gerar o vetor de busca.");
  });
});
