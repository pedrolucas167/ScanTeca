import fs from "node:fs";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";

const local = {};
for (const path of [".env", ".env.local", ".env.development.local"]) {
  if (fs.existsSync(path)) Object.assign(local, dotenv.parse(fs.readFileSync(path)));
}
const live = process.argv.slice(2);
if (live.some(arg => arg !== "--live")) throw new Error("Use only --live to call the real free providers.");
const database = "postgresql://scanteca_test:scanteca_test_local@127.0.0.1:55439/scanteca_reading_test";
const env = { ...process.env, NODE_ENV: "development", DATABASE_URL: database, SCANTECA_TEST_DATABASE_URL: database,
  SCANTECA_TEST_REDIS: "127.0.0.1:56379",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || local.OPENROUTER_API_KEY || "",
  ORACLE_FREE_MODELS: process.env.ORACLE_FREE_MODELS || local.ORACLE_FREE_MODELS || "",
  UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", KV_URL: "",
};
if (live.length && !env.OPENROUTER_API_KEY) throw new Error("A local OpenRouter key is required for live testing.");
if (live.length) {
  // Quota is account-governed; never try another key or a paid model to evade it.
  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }, signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response?.ok) throw new Error("Não foi possível confirmar a cota gratuita antes da rodada.");
  const { data } = await response.json();
  const value = data?.free_model_daily_requests;
  const quota = value ? { used: value.used, limit: value.limit, remaining: value.remaining } : null;
  const modelCount = new Set(env.ORACLE_FREE_MODELS.split(",").filter(Boolean)).size || 1;
  const worstCaseCalls = 4 * 2 * modelCount * Math.min(modelCount, 2);
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/oracle-free-quota.json", JSON.stringify({ checkedAt: new Date().toISOString(), quota, worstCaseCalls }, null, 2));
  if (typeof quota?.remaining === "number" && quota.remaining < worstCaseCalls) {
    console.error(`Rodada não iniciada: restam ${quota.remaining} chamadas gratuitas; o orçamento conservador desta rodada é ${worstCaseCalls}. Nenhum modelo pago será usado.`);
    process.exit(1);
  }
}
const compose = ["compose", "--project-name", `scanteca-oracle-benchmark-${process.pid}`, "--file", "compose.e2e.yml"];
const redisName = `scanteca-oracle-redis-${process.pid}`;
let databaseStarted = false;
let redisStarted = false;
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("Benchmark stage failed; see the sanitized output above.");
}
try {
  databaseStarted = true;
  run("docker", [...compose, "up", "--detach", "--wait"]);
  run("docker", ["run", "--detach", "--rm", "--name", redisName, "--publish", "127.0.0.1:56379:6379", "redis:7-alpine"]);
  redisStarted = true;
  run(process.execPath, ["scripts/prepare-test-database.mjs"]);
  run(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"]);
  run(process.execPath, ["--import", "tsx", "scripts/benchmark-oracle-free.ts", ...live]);
} catch {
  console.error("Benchmark não aprovado; as falhas permanecem no relatório local quando a rodada iniciou.");
  process.exitCode = 1;
} finally {
  if (redisStarted) {
    const result = spawnSync("docker", ["stop", redisName], { stdio: "inherit", windowsHide: true });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }
  if (databaseStarted) {
    const result = spawnSync("docker", [...compose, "down", "--volumes"], { stdio: "inherit", windowsHide: true });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }
}
