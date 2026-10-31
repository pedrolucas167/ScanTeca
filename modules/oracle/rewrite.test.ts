import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { contextualizeQuestion } from "./rewrite";
const history = [{ role: "user", content: "Qual o tema de Duna?" }];
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.restoreAllMocks());
describe("Oracle rewrite fallbacks", () => {
  it("does not call the provider without history", async () => {
    expect(await contextualizeQuestion("Qual livro?", [], "fixture")).toBe("Qual livro?");
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
  it("preserves the question and releases a rejected provider response", async () => {
    const cancel = vi.fn();
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 503 }));
    expect(await contextualizeQuestion("E o autor?", history, "fixture")).toBe("E o autor?");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("preserves the question on malformed provider JSON", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response("fixture-invalid-json"));
    expect(await contextualizeQuestion("E o autor?", history, "fixture")).toBe("E o autor?");
  });
  it("returns the rewrite while preserving history and recording reported usage", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "Quem escreveu Duna?" } }], usage: { prompt_tokens: 20, completion_tokens: 4 } }));
    const before = JSON.stringify(history);
    const onUsage = vi.fn();
    const signal = new AbortController().signal;
    expect(await contextualizeQuestion("E o autor?", history, "fixture", { signal, onUsage })).toBe("Quem escreveu Duna?");
    expect(JSON.stringify(history)).toBe(before);
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 20, outputTokens: 4, costUsd: null });
    expect(fetchWithTimeout).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal }));
  });
});
