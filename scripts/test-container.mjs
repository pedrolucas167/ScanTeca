import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const project = `scanteca-container-smoke-${process.pid}`;
// Compose otherwise implicitly loads the user's .env, even without env_file.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "scanteca-container-env-"));
const envFile = path.join(temporary, "empty.env");
fs.writeFileSync(envFile, "");
const compose = ["compose", "--env-file", envFile, "--project-name", project, "--file", "compose.container-test.yml"];
function docker(args, capture = false) {
  const result = spawnSync("docker", args, { stdio: capture ? "pipe" : "inherit", encoding: "utf8", timeout: 20 * 60 * 1000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Comando Docker reprovado: ${args.slice(0, 2).join(" ")}`);
  return result.stdout?.trim();
}
async function awaitStatus(base, status) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) });
      if (response.status === status) {
        assert.deepEqual(await response.json(), { status: status === 200 ? "ok" : "unavailable" });
        assert.equal(response.headers.get("cache-control"), "no-store");
        return;
      }
    } catch { /* Container may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Readiness não atingiu o status esperado: ${status}`);
}

try {
  docker([...compose, "build"]);
  docker([...compose, "up", "--detach", "app"]);
  const binding = docker([...compose, "port", "app", "3000"], true);
  assert.match(binding, /^127\.0\.0\.1:\d+$/u);
  const base = `http://${binding}`;
  await awaitStatus(base, 200);
  const response = await fetch(`${base}/favicon-32x32.png`);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync("public/favicon-32x32.png"));
  const container = docker([...compose, "ps", "--quiet", "app"], true);
  assert.equal(docker(["inspect", "--format", "{{.Config.User}}", container], true), "node");
  docker([...compose, "exec", "--no-TTY", "app", "node", "-e", "const fs=require('node:fs');if(fs.existsSync('/app/.env')||fs.existsSync('/app/.git')||fs.existsSync('/usr/local/lib/node_modules/npm')||process.env.CLERK_SECRET_KEY)process.exit(1)"]);
  docker([...compose, "exec", "--no-TTY", "database", "psql", "-U", "scanteca_dev", "-d", "scanteca_container_dev", "-c", 'SELECT count(*) FROM "SocialProfile"']);
  docker([...compose, "stop", "database"]);
  await awaitStatus(base, 503);
  docker([...compose, "start", "database"]);
  await awaitStatus(base, 200);
  process.stdout.write("Container aprovado: schema local, readiness 200/503/200, estáticos, usuário sem privilégios e isolamento.\n");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const cleanup = spawnSync("docker", [...compose, "down", "--volumes", "--remove-orphans"], { stdio: "inherit", timeout: 60000, windowsHide: true });
  if (cleanup.error || cleanup.status !== 0) process.exitCode = 1;
  fs.unlinkSync(envFile);
  fs.rmdirSync(temporary);
}
