import { spawnSync } from "node:child_process";
import { loadDevelopmentClerkKeys } from "./e2e-clerk-keys.mjs";

const database = "postgresql://scanteca_test:scanteca_test_local@127.0.0.1:55439/scanteca_reading_test";
const env = {
  ...process.env, DATABASE_URL: database, SCANTECA_TEST_DATABASE_URL: database,
  E2E_AUTHENTICATED: "1", E2E_PRODUCTION: "1",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", OPENROUTER_API_KEY: "",
  UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", KV_URL: "",
};
const compose = ["compose", "--project-name", `scanteca-e2e-${process.pid}`, "--file", "compose.e2e.yml"];
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("Etapa do E2E autenticado falhou; veja o diagnóstico acima.");
}

let cleanup = false;
try {
  Object.assign(env, loadDevelopmentClerkKeys());
  // Valida chaves e destino antes de criar serviços ou contas.
  run(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--list", "--project=authenticated"]);
  cleanup = true;
  run("docker", [...compose, "up", "--detach", "--wait"]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"]);
  run(process.execPath, ["node_modules/@playwright/test/cli.js", "install", "chromium"]);
  run(process.execPath, ["node_modules/prisma/build/index.js", "generate"]);
  run(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
  run(process.execPath, ["scripts/run-e2e.mjs", "--project=authenticated", "--retries=0"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (cleanup) {
    const result = spawnSync("docker", [...compose, "down", "--volumes"], { env, stdio: "inherit", windowsHide: true });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }
}
