import { afterEach, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./fetch-with-retry";

afterEach(() => { vi.unstubAllGlobals(); });

it("não repete uma chamada cancelada durante fetch", async () => {
  const controller = new AbortController();
  const fetchMock = vi.fn(async () => { controller.abort(); throw controller.signal.reason; });
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchWithRetry("https://example.invalid", { signal: controller.signal, baseDelay: 0 })).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("não inicia fetch quando o orçamento já expirou", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchWithRetry("https://example.invalid", { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: "AbortError" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("preserva retry para falhas transitórias", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
  expect((await fetchWithRetry("https://example.invalid", { baseDelay: 0 })).status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
