import { afterEach, expect, it, vi } from "vitest";
import { getLcpAttribution } from "./lcp-attribution";

afterEach(() => vi.unstubAllGlobals());

it("não relata URLs ou conteúdo do elemento", () => {
  const privateUrl = "https://example.invalid/private-book?secret=value";
  const lookup = vi.fn(() => [{ startTime: 800, responseEnd: 1400 }]);
  vi.stubGlobal("performance", { getEntriesByName: lookup });
  const result = getLcpAttribution([{ startTime: 1800, url: privateUrl, element: { tagName: "IMG", textContent: "Private book" } } as unknown as PerformanceEntry]);
  expect(result).toEqual({ element: "IMG", paintMs: 1800, resourceStartMs: 800, resourceEndMs: 1400 });
  expect(lookup).toHaveBeenCalledWith(privateUrl, "resource");
  expect(JSON.stringify(result)).not.toMatch(/private|secret|example/i);
});

it("suporta conteúdo textual sem recurso associado", () => {
  expect(getLcpAttribution([{ startTime: 500, element: { tagName: "H1" } } as unknown as PerformanceEntry])).toEqual({ element: "H1", paintMs: 500 });
});

it("não gera atribuição quando não há entrada de pintura", () => {
  expect(getLcpAttribution([])).toBeUndefined();
});

it("restringe nomes de elementos a uma lista sem identificadores", () => {
  expect(getLcpAttribution([{ startTime: 100, element: { tagName: "PRIVATE-COMPONENT" } } as unknown as PerformanceEntry])).toEqual({ element: "OTHER", paintMs: 100 });
});
