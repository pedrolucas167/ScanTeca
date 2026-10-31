import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
import { fetchWithTimeout } from "./fetch-with-timeout";
import { generateEmbedding } from "./embeddings";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("OPENROUTER_API_KEY", "fixture"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("Oracle embedding cancellation and usage", () => {
  it("passes the abort signal and reports only returned usage", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ data: [{ embedding: [0.1] }], usage: { prompt_tokens: 12 } }));
    const signal = new AbortController().signal;
    const onUsage = vi.fn();
    expect(await generateEmbedding("Pergunta fictícia", { signal, onUsage })).toEqual([0.1]);
    expect(fetchWithTimeout).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal }));
    expect(onUsage).toHaveBeenCalledExactlyOnceWith({ inputTokens: 12, outputTokens: null, costUsd: null });
  });
  it("does not call the provider if the request is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await generateEmbedding("Pergunta fictícia", { signal: controller.signal })).toBeNull();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
});
