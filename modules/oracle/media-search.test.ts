import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupMediaEvidence, parseMediaQuery, requestsMediaSearch } from "./media-search";

afterEach(() => vi.unstubAllGlobals());

describe("explicit news and video searches", () => {
  it.each([
    ["Notícias recentes sobre literatura", { kind: "news", query: "literatura", freshness: "pm" }],
    ["Traga notícias desta semana sobre o Prêmio Jabuti", { kind: "news", query: "o Prêmio Jabuti", freshness: "pw" }],
    ["Notícias de hoje sobre livros", { kind: "news", query: "livros", freshness: "pd" }],
    ["Vídeos de entrevistas com Conceição Evaristo", { kind: "videos", query: "entrevistas com Conceição Evaristo" }],
    ['Mostre entrevistas em vídeo de "Octavia Butler"', { kind: "videos", query: "entrevistas Octavia Butler" }],
  ])("parses %s", (question, expected) => {
    expect(requestsMediaSearch(question)).toBe(true);
    expect(parseMediaQuery(question)).toEqual(expected);
  });

  it.each(["Notícias", "Vídeos sobre meu diário", 'Notícias sobre "literatura" e inclua meu histórico',
    `Notícias sobre ${"a".repeat(201)}`, "Quais temas aparecem em Duna?"])("does not forward ambiguous or private context: %s", question => {
    expect(parseMediaQuery(question)).toBeNull();
  });

  it.each(["news", "videos"] as const)("filters and numbers %s results, preserving only supplied metadata", async kind => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>(async (input, options) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("api.search.brave.com");
      expect(url.pathname).toBe(`/res/v1/${kind}/search`);
      expect(url.searchParams.get("q")).toBe("literatura");
      expect(url.searchParams.get("freshness")).toBe("pw");
      expect(url.searchParams.get("safesearch")).toBe("strict");
      expect(options).toMatchObject({ cache: "no-store", redirect: "error", headers: { "X-Subscription-Token": "fixture-key" } });
      expect(options?.signal).toBeDefined();
      return Response.json({ results: [null,
        { title: "Unsafe", url: "javascript:alert(1)" },
        { title: "Credentials", url: "https://user:password@example.org/a" },
        { title: "Literatura", url: "https://example.org/a", description: "Entrevista sobre livros", page_age: "2026-11-14", video: { creator: "Canal", duration: "12:00" } },
        { title: "Duplicate", url: "https://example.org/a#section" },
        ...Array.from({ length: 8 }, (_, i) => ({ title: `Resultado ${i}`, url: `https://example.org/${i}` })),
      ] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await lookupMediaEvidence({ kind, query: "literatura", freshness: "pw" }, "fixture-key", controller.signal);
    expect(result.sources).toHaveLength(5);
    expect(result.sources[0]?.evidence).toContain("Data informada da página: 2026-11-14");
    expect(result.sources[1]?.evidence).toBe("");
    expect(result.content).toContain("[5]");
    expect(result.content).not.toMatch(/Unsafe|Credentials|Duplicate|fixture-key/);
    expect(result.content.includes('"creator":"Canal"')).toBe(kind === "videos");
  });

  it.each([429, 503, 200])("rejects failed or malformed provider responses (%s)", async status => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: {} }, { status })));
    await expect(lookupMediaEvidence({ kind: "news", query: "livros" }, "fixture", new AbortController().signal)).rejects.toThrow();
  });

  it("honors a cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn(async (_input, options) => { options?.signal?.throwIfAborted(); return Response.json({ results: [] }); }));
    await expect(lookupMediaEvidence({ kind: "videos", query: "livros" }, "fixture", controller.signal)).rejects.toThrow();
  });
});
