import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ books: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: {
  $queryRaw: mocks.books,
  diaryEntry: { count: async () => 0 },
  review: { count: async () => 0 },
  book: { count: async () => 0 },
  recommendationFeedback: { findMany: async () => [] },
} }));
import { buildRecommendations, searchGoogleBooks } from "./recommendations";

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-only");
  vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
  mocks.books.mockResolvedValue([{
    id: "book", title: "Viagem aventuras montanhas", author: "Autora Exemplo", genre: "Literatura",
    synopsis: "Viagem aventuras montanhas", notes: null, rating: null, status: "TO_READ", coverUrl: null,
    pages: 100, publishedDate: null, embeddingText: null,
  }]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("compartilha o orçamento entre busca em português e fallback", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ items: [] }))
    .mockResolvedValueOnce(Response.json({ items: [{ id: "candidate", volumeInfo: { title: "Livro" } }] }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await searchGoogleBooks("Livro")).toHaveLength(1);
  const first = fetchMock.mock.calls[0]!;
  const second = fetchMock.mock.calls[1]!;
  expect(first[0]).toContain("langRestrict=pt");
  expect(second[0]).not.toContain("langRestrict");
  expect(first[1].signal).toBe(second[1].signal);
});

it("degrada para busca vazia ao exceder timeout sem repetir fetch", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(20));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await searchGoogleBooks("Livro")).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("inicia buscas de perfil enquanto IA espera, com até três buscas por grupo", async () => {
  let releaseLLM!: () => void;
  const llm = new Promise<Response>((resolve) => {
    releaseLLM = () => resolve(Response.json({ choices: [{ message: { content: "[]" } }] }));
  });
  const releaseSearches: (() => void)[] = [];
  let active = 0;
  let peak = 0;
  let released = false;
  const fetchMock = vi.fn((url: string) => {
    if (url.includes("openrouter.ai")) return llm;
    active++;
    peak = Math.max(peak, active);
    return new Promise<Response>((resolve) => {
      const done = () => { active--; resolve(Response.json({ items: [] })); };
      if (released) done(); else releaseSearches.push(done);
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const result = buildRecommendations("reader");
  await vi.waitFor(() => expect(releaseSearches).toHaveLength(3));
  expect(fetchMock.mock.calls.some(([url]) => url.includes("openrouter.ai"))).toBe(true);
  released = true;
  releaseSearches.forEach((release) => release());
  releaseLLM();
  expect((await result).books).toHaveLength(1);
  expect(peak).toBe(3);
});
