// Opt-in comparison against the actual pre-change source in Git. No real services.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, expect, it, vi } from "vitest";
import * as metadata from "../lib/book-metadata";
import { fetchWithRetry } from "../lib/fetch-with-retry";

const state = vi.hoisted(() => ({
  cached: null as unknown,
  cacheDelay: 10,
  cacheAvailable: true,
  cacheStalled: false,
  calls: 0,
  active: 0,
  peak: 0,
}));
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const books = [{
  id: "book", title: "Viagem aventuras montanhas", author: "Autora Exemplo", genre: "Literatura",
  synopsis: "Viagem aventuras montanhas", notes: null, rating: null, status: "TO_READ",
  coverUrl: null, pages: 100, publishedDate: null, embeddingText: "[1,0]",
}];
const database = {
  $queryRaw: async () => books,
  diaryEntry: { count: async () => 0 }, review: { count: async () => 0 },
  book: { count: async () => 0 }, recommendationFeedback: { findMany: async () => [] },
};
vi.mock("../lib/prisma", () => ({ prisma: {
  $queryRaw: (...args: unknown[]) => database.$queryRaw(...args as []),
  diaryEntry: { count: async () => 0 }, review: { count: async () => 0 },
  book: { count: async () => 0 }, recommendationFeedback: { findMany: async () => [] },
} }));
vi.mock("../lib/embeddings", () => ({ generateEmbedding: async () => { state.calls++; await pause(20); return [1, 0]; } }));
vi.mock("../lib/recommendations-cache", () => ({
  getRecommendationsSnapshot: async () => {
    if (state.cacheStalled) return new Promise(() => {});
    if (!state.cacheAvailable) return { payload: null, version: null };
    await pause(state.cacheDelay);
    return { payload: state.cached, version: "version" };
  },
  setCachedRecommendations: async (_user: string, payload: unknown) => {
    await pause(state.cacheDelay);
    state.cached = payload;
    return true;
  },
}));
import { getRecommendations } from "../lib/recommendations-service";
import type { RecommendationsPayload } from "../lib/recommendations";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("compara geração anterior, cache miss, cache hit e Redis indisponível", async () => {
  const baselineRef = process.env.SCANTECA_PERF_BASELINE || "origin/main";
  const source = execFileSync("git", ["show", `${baselineRef}:lib/recommendations.ts`], { encoding: "utf8" });
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const legacyExports: { buildRecommendations?: (user: string) => Promise<RecommendationsPayload> } = {};
  const providers: Record<string, unknown> = {
    "./prisma": { prisma: database },
    "./book-metadata": metadata,
    "./fetch-with-retry": { fetchWithRetry },
    "./embeddings": { generateEmbedding: async () => { state.calls++; await pause(20); return [1, 0]; } },
  };
  new Function("require", "exports", output.outputText)((id: string) => {
    if (!(id in providers)) throw new Error(`Unexpected baseline dependency: ${id}`);
    return providers[id];
  }, legacyExports);
  const legacy = legacyExports.buildRecommendations!;
  vi.stubEnv("OPENROUTER_API_KEY", "test-only");
  vi.stubEnv("GOOGLE_BOOKS_API_KEY", "");
  vi.stubGlobal("fetch", async (url: string) => {
    state.calls++;
    if (url.includes("openrouter.ai")) {
      await pause(80);
      return Response.json({ choices: [{ message: { content: JSON.stringify(
        Array.from({ length: 5 }, (_, id) => ({ title: `Sugestão ${id}`, author: "Escritora Nova", tags: [] }))
      ) } }] });
    }
    state.active++;
    state.peak = Math.max(state.peak, state.active);
    await pause(40);
    state.active--;
    const query = new URL(url).searchParams.get("q");
    return Response.json({ items: [{ id: query, volumeInfo: {
      title: `Candidato ${query}`, authors: ["Escritora Nova"], pageCount: 200, categories: ["Literatura"],
    } }] });
  });
  const normalize = (data: RecommendationsPayload) => ({ ...data, books: data.books.map(({ createdAt: _date, ...book }) => book) });
  const rows: { scenario: string; medianMs: number; providerCalls: number; peakGoogle: number }[] = [];
  let expected: ReturnType<typeof normalize>;
  async function measure(scenario: string, run: () => Promise<RecommendationsPayload>, prepare: () => void) {
    const samples: number[] = [];
    let calls = 0;
    let peak = 0;
    for (let i = 0; i < 5; i++) {
      prepare(); state.calls = 0; state.peak = 0;
      const started = performance.now();
      const result = await run();
      samples.push(performance.now() - started);
      calls = state.calls; peak = state.peak;
      expected ??= normalize(result);
      expect(normalize(result)).toEqual(expected);
      expect(result.primary).not.toBeNull();
    }
    rows.push({ scenario, medianMs: Math.round(samples.sort((a, b) => a - b)[2]!), providerCalls: calls, peakGoogle: peak });
  }
  await measure("before", () => legacy("reader"), () => { state.cached = null; });
  await measure("after-cache-miss", async () => (await getRecommendations("reader")).data, () => { state.cached = null; });
  await measure("after-cache-hit", async () => (await getRecommendations("reader")).data, () => {});
  state.cacheAvailable = false;
  await measure("after-no-redis", async () => (await getRecommendations("reader")).data, () => { state.cached = null; });
  state.cacheStalled = true;
  await measure("after-stalled-redis", async () => (await getRecommendations("reader")).data, () => { state.cached = null; });
  const report = JSON.stringify({
    baselineRef,
    baselineCommit: execFileSync("git", ["rev-parse", baselineRef], { encoding: "utf8" }).trim(),
    samplesPerScenario: 5, delaysMs: { llm: 80, google: 40, embedding: 20, redis: 10 }, rows,
  }, null, 2);
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/recommendations-performance.json", report + "\n");
  const before = rows[0]!.medianMs;
  expect(rows[1]!.medianMs).toBeLessThan(before);
  expect(rows[2]!.providerCalls).toBe(0);
  expect(rows[3]!.medianMs).toBeLessThan(before);
  // Cache failure is bounded; it may add latency for otherwise fast generations.
  expect(rows[4]!.medianMs).toBeLessThan(before + 250);
  for (const row of [rows[1]!, rows[3]!, rows[4]!]) expect(row.providerCalls).toBe(rows[0]!.providerCalls);
  expect(rows.slice(1).every((row) => row.peakGoogle <= 6)).toBe(true);
}, 20000);
