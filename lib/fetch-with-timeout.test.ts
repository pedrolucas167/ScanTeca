import { afterEach, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetch-with-timeout";
afterEach(() => vi.unstubAllGlobals());
it("aborta uma requisição que não responde", async () => {
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  })));
  await expect(fetchWithTimeout("https://example.invalid", {}, 20)).rejects.toMatchObject({ name: "TimeoutError" });
});
it("preserva o cancelamento do chamador", async () => {
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  })));
  const controller = new AbortController();
  const request = fetchWithTimeout("https://example.invalid", { signal: controller.signal });
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
});
