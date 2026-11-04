import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_FREE_MODELS, parseFreeModels } from "@/lib/openrouter-pool";
import { openRouterChat, type ModelAttempt } from "@/lib/openrouter-chat";
import { validateOracleResponse } from "@/lib/oracle-quality";
import { freeModelCorpus, freeModelCases, freeModelExternal, freeModelCriteria } from "@/tests/oracle-free-model-fixtures";
import type { OracleUsage } from "@/lib/oracle-usage";

async function main() {
  const live = process.argv.includes("--live");
  if (process.argv.slice(2).some(arg => arg !== "--live")) throw new Error("Invalid argument");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Disposable test database required");
  const database = new URL(raw);
  if (database.hostname !== "127.0.0.1" || database.port !== "55439" || database.pathname !== "/scanteca_reading_test" || database.search) throw new Error("Invalid database destination");
  // Override before importing the shared Prisma singleton; never seed a .env database.
  process.env.DATABASE_URL = raw;
  const { prisma } = await import("@/lib/prisma");
  const { retrieveBooks, readOracleCompletion, validateCitations, validateInventoryClaims, buildOracleSystemPrompt, formatOracleContext } = await import("@/modules/oracle");
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (live && !apiKey) throw new Error("OpenRouter key required");
  const models = parseFreeModels(process.env.ORACLE_FREE_MODELS || DEFAULT_FREE_MODELS.join(","));
  process.env.ORACLE_FREE_MODELS = models.join(",");
  // This standalone development benchmark must not use Redis credentials from .env.
  for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "KV_URL"]) process.env[name] = "";
  const userId = `oracle-benchmark-${randomUUID()}`;
  const otherUser = `${userId}-other`;
  const startedAt = new Date().toISOString();
  const results: Record<string, unknown>[] = [];
  let lastStart = 0;
  const save = async () => {
    await mkdir("reports", { recursive: true });
    await writeFile(`reports/oracle-free-benchmark-${startedAt.replace(/[:.]/g, "-")}.json`, JSON.stringify({
      version: 3, startedAt, live, models, criteria: freeModelCriteria,
      fixtureHash: createHash("sha256").update(JSON.stringify({ freeModelCorpus, freeModelCases, freeModelExternal })).digest("hex"),
      limitations: "Fictional corpus with real PostgreSQL retrieval and application formatter/prompt/completion checks; no embeddings, authenticated HTTP, real external catalog, automatic semantic judge or independent human review. First delta is not validated display time. Short run does not establish long-term reliability. All failed attempts retained.",
      results,
    }, null, 2));
  };
  try {
    const collection = await prisma.collection.create({ data: { userId, name: "Benchmark fictício" } });
    const otherCollection = await prisma.collection.create({ data: { userId: otherUser, name: "Acervo privado fictício" } });
    await prisma.book.createMany({ data: freeModelCorpus.map((book, index) => ({ ...book, userId, collectionId: collection.id, isbn: `fixture-${index}` })) });
    await prisma.book.create({ data: { userId: otherUser, collectionId: otherCollection.id, isbn: "fixture-private", title: "Memórias da Praça Azul — privado", author: "Outro leitor", status: "TO_READ", synopsis: "Segredo de outra conta." } });
    for (let repetition = 0; repetition < freeModelCriteria.repetitions; repetition++) {
      for (const scenario of freeModelCases) {
        const retrievalStarted = performance.now();
        const retrieval = await retrieveBooks(userId, scenario.question, [], scenario.mode);
        const formatted = formatOracleContext({ contextBooks: retrieval.books, externalBooks: scenario.scope === "all" ? [freeModelExternal] : [],
          readingNow: [], weekLogs: [], diaryEntries: [], similarBooks: [], semanticDiary: [], semanticReviews: [], semanticExternal: [], retrievalQuery: scenario.question });
        const retrievalMs = Math.round(performance.now() - retrievalStarted);
        const sourceChecks = scenario.expectedTitles.every(title => formatted.sources.some(source => source.title === title))
          && formatted.sources.every(source => !source.title.includes("privado"));
        for (let slot = 0; slot < models.length; slot++) {
          const metadata = { case: scenario.id, repetition: repetition + 1, slot, retrievalMs, sourceChecks, sources: formatted.sources, context: formatted.content };
          if (!sourceChecks || !formatted.hasGrounding) { results.push({ ...metadata, status: "retrieval_failed" }); await save(); continue; }
          if (!live) { results.push({ ...metadata, status: "not_run" }); continue; }
          // Below the shared 20 RPM limit even when models respond immediately.
          await delay(Math.max(0, 3100 - (Date.now() - lastStart)));
          lastStart = Date.now();
          const started = performance.now();
          const attempts: ModelAttempt[] = [];
          let answer: string | null = null;
          let partialAnswer = "";
          let firstDeltaMs: number | null = null;
          let usage: OracleUsage | null = null;
          try {
            const response = await openRouterChat({ apiKey: apiKey!, timeoutMs: freeModelCriteria.timeoutMs,
              onAttempt: attempt => attempts.push(attempt), body: { model: models[0], stream: true, temperature: 0.3,
                max_tokens: freeModelCriteria.maxTokens, messages: [
                  { role: "system", content: buildOracleSystemPrompt({ mode: scenario.mode, scope: scenario.scope, profile: scenario.profile }) },
                  { role: "user", content: `${formatted.content}\n\nPergunta do usuário: ${scenario.question}` },
                ] } });
            if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
            answer = await readOracleCompletion(response.body!, { onDelta(text) { partialAnswer += text; if (text && firstDeltaMs === null) firstDeltaMs = Math.round(performance.now() - started); }, onUsage(value) { usage = value; } });
            const durationMs = Math.round(performance.now() - started);
            const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
            const citationCheck = validateCitations(answer, formatted.sources.length);
            const expectedCitations = scenario.expectedTitles.map(title => formatted.sources.findIndex(source => source.title === title) + 1);
            const checks = { sourceChecks, textQuality: validateOracleResponse(answer).valid, citations: citationCheck.valid && expectedCitations.every(number => number > 0 && citationCheck.citations.includes(number)),
              inventory: validateInventoryClaims(answer).valid, mentions: scenario.expectedTitles.every(title => normalize(answer!).includes(normalize(title))),
              terms: scenario.expectedTerms.every(term => normalize(answer!).includes(normalize(term))), latency: durationMs <= freeModelCriteria.maxCompletionMs };
            const passed = Object.values(checks).every(Boolean);
            results.push({ ...metadata, status: passed ? "mechanical_checks_passed" : "failed", attempts, answer, checks, durationMs, firstDeltaMs, usage, humanReview: "pending" });
            process.stdout.write(`${scenario.id} repeat ${repetition + 1}: ${passed ? "CHECKS PASS" : "FAIL"} (${durationMs} ms)\n`);
          } catch (error) {
            const reason = error instanceof Error && /^(HTTP \d+|Oracle completion was truncated|Oracle provider rejected completion|Oracle connection ended before completion)$/.test(error.message)
              ? error.message : "Provider, timeout or completion failure";
            results.push({ ...metadata, status: "error", attempts, answer, partialAnswer, durationMs: Math.round(performance.now() - started), firstDeltaMs, usage, error: reason, humanReview: "pending" });
            process.stdout.write(`${scenario.id} repeat ${repetition + 1}: ERROR\n`);
          }
          await save();
        }
      }
    }
  } finally {
    await save();
    await prisma.book.deleteMany({ where: { userId: { in: [userId, otherUser] } } });
    await prisma.collection.deleteMany({ where: { userId: { in: [userId, otherUser] } } });
    await prisma.$disconnect();
  }
  if (live && results.some(result => result.status !== "mechanical_checks_passed")) process.exitCode = 1;
}
main().catch(() => { process.stderr.write("Benchmark não concluído; confira configuração e serviços descartáveis.\n"); process.exitCode = 1; });
