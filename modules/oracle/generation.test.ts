import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
vi.mock("./history", () => ({ saveOracleAnswer: vi.fn() }));
vi.mock("./profile", () => ({ updateReaderProfile: vi.fn() }));
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { consumeOracleEvents } from "@/lib/oracle-stream";
import type { OracleStreamEvent } from "@/lib/types/oracle";
import { generateOracleResponse } from "./generation";
import { saveOracleAnswer } from "./history";
import { createOracleMetrics } from "./metrics";

const input = (): Parameters<typeof generateOracleResponse>[0] => ({
  pipeline: { signal: new AbortController().signal, stage: vi.fn(), metrics: createOracleMetrics(), defer: vi.fn(), reject: vi.fn() },
  userId: "owner", sessionId: "session", mode: "EXPLORE", question: "Pergunta", apiKey: "fixture", temperature: 0.3,
  messages: [{ role: "user", content: "Pergunta" }], sources: [{ id: "book", title: "Duna", author: "Herbert" }],
  retrievalStats: { durationMs: 1, vectorCandidates: 1, selectedBooks: 1, selectedDiary: 0, selectedReviews: 0, externalBooks: 0, scope: "library" },
  setting: null, conversationLength: 4,
});
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("Oracle generation module failure boundaries", () => {
  it("does not expose text or schedule learning when persistence fails", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"Duna aborda ecologia em um planeta desértico [1]."}}]}\n\ndata: [DONE]\n\n'));
    vi.mocked(saveOracleAnswer).mockRejectedValueOnce(new Error("fixture-write-failed"));
    const data = input();
    const response = await generateOracleResponse(data);
    const events: OracleStreamEvent[] = [];
    await expect(consumeOracleEvents<OracleStreamEvent>(response.body, event => events.push(event))).rejects.toThrow("concluir");
    expect(events.some(event => event.text)).toBe(false);
    expect(data.pipeline.defer).not.toHaveBeenCalled();
  });
  it("cancels the provider body and skips persistence when the consumer cancels", async () => {
    const cancel = vi.fn();
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response(new ReadableStream({ cancel })));
    const response = await generateOracleResponse(input());
    await response.body!.cancel();
    expect(cancel).toHaveBeenCalledOnce();
    expect(saveOracleAnswer).not.toHaveBeenCalled();
  });
  it("releases failed provider responses without returning their body", async () => {
    const cancel = vi.fn();
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 429 }));
    const response = await generateOracleResponse(input());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Erro ao consultar o Oráculo" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(saveOracleAnswer).not.toHaveBeenCalled();
  });
});
