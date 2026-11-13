import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { developmentClerkKeys } from "./e2e-clerk-keys.mjs";
import { aggregateLighthouse, publicPerformancePages } from "./lighthouse-policy.mjs";

const root = process.cwd();
fs.mkdirSync(path.resolve("reports"), { recursive: true });
const directory = fs.mkdtempSync(path.resolve("reports", "lighthouse-run-"));
const output = path.resolve("reports/lighthouse/public");
fs.mkdirSync(output, { recursive: true });
const envFile = path.join(directory, "empty.env");
fs.writeFileSync(envFile, "");
const project = `scanteca-lighthouse-${process.pid}`;
const compose = ["compose", "--env-file", envFile, "--project-name", project, "--file", "docker/compose.container-test.yml", "--file", "docker/compose.lighthouse.yml"];
const publicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const environment = {};
// Never forward CI tokens, application credentials or the user's .env to browsers/tools.
for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "ProgramFiles", "PROGRAMFILES", "DOCKER_CONFIG"]) {
  if (process.env[name]) environment[name] = process.env[name];
}
let dockerEnv;
let browser;
let composeStarted = false;
let stage = "configuration";
function run(command, args, label, env = environment, cwd = root) {
  const result = spawnSync(command, args, { env, cwd, encoding: "utf8", windowsHide: true, timeout: 12 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(directory, `${label}.log`), `${result.stdout || ""}\n${result.stderr || ""}`);
  if (result.error || result.status !== 0) throw new Error(`Etapa isolada reprovada: ${label}.`);
  return result.stdout.trim();
}
async function ready(base) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try { if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(7000) })).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Servidor descartável indisponível.");
}
try {
  for (const name of ["metrics.json", "summary.md"]) fs.rmSync(path.join(output, name), { force: true });
  const keys = developmentClerkKeys(process.env);
  if (!/^pk_test_[A-Za-z0-9_-]{20,}$/u.test(publicKey || "") || !/^sk_test_[A-Za-z0-9_-]{20,}$/u.test(keys.CLERK_SECRET_KEY)) throw new Error("Configure as duas chaves Clerk de desenvolvimento.");
  dockerEnv = { ...environment, ...keys };
  const context = run("docker", ["context", "show"], "context", dockerEnv);
  const endpoint = run("docker", ["context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}"], "endpoint", dockerEnv);
  if (!/^(unix|npipe):/u.test(endpoint)) throw new Error("Performance permite somente Docker local.");
  process.stdout.write("Construindo ambiente descartável para páginas públicas.\n");
  stage = "build";
  run("docker", [...compose, "build"], "build", dockerEnv);
  composeStarted = true;
  stage = "startup";
  run("docker", [...compose, "up", "--detach", "app"], "up", dockerEnv);
  stage = "port-binding";
  const binding = run("docker", [...compose, "port", "app", "3000"], "port", dockerEnv);
  if (!/^127\.0\.0\.1:\d+$/u.test(binding)) throw new Error("Porta de performance não está em loopback.");
  const base = `http://${binding}`;
  stage = "readiness";
  await ready(base);
  stage = "browser-preflight";
  browser = await chromium.launch({ headless: true, env: environment });
  const chromiumVersion = browser.version();
  const page = await browser.newPage();
  for (const [route, marker] of [["/", "Sua estante de livros físicos"], ["/manifesto", "O Fim do Caos Literário"]]) {
    const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
    fs.writeFileSync(path.join(directory, "preflight.json"), JSON.stringify({ route, status: response?.status() }));
    if (response?.status() !== 200 || !(await page.locator("h1").textContent())?.includes(marker)) throw new Error("Página pública incorreta; medição cancelada.");
  }
  await browser.close(); browser = undefined;
  const config = { ci: { collect: { url: publicPerformancePages.map(route => `${base}${route}`), numberOfRuns: 3,
    settings: { formFactor: "mobile", throttlingMethod: "simulate", chromeFlags: "--headless --no-sandbox --disable-dev-shm-usage" } } } };
  const configPath = path.join(directory, "lighthouserc.json");
  fs.writeFileSync(configPath, JSON.stringify(config));
  process.stdout.write("Páginas públicas verificadas; coletando seis amostras Lighthouse.\n");
  stage = "collection";
  run(process.execPath, [path.resolve("tools/lighthouse/node_modules/@lhci/cli/src/cli.js"), "collect", "--config", configPath], "collect", { ...environment, CHROME_PATH: chromium.executablePath() }, directory);
  stage = "report-validation";
  const raw = path.join(directory, ".lighthouseci");
  const reports = fs.readdirSync(raw).filter(name => /^lhr-.*\.json$/u.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(raw, name), "utf8")));
  const metrics = aggregateLighthouse(reports, base, chromiumVersion);
  stage = "safe-output";
  fs.writeFileSync(path.join(output, "metrics.json"), JSON.stringify(metrics, null, 2));
  const lines = ["## Lighthouse: baseline público", "", "Três amostras por página; mediana mobile simulada. Métricas informativas, sem limite de desempenho obrigatório nesta fase.", "", "| Página | Performance | LCP ms | CLS | TBT ms | Bytes |", "| --- | ---: | ---: | ---: | ---: | ---: |"];
  for (const result of metrics.pages) lines.push(`| ${result.path} | ${Math.round(result.median.performance * 100)} | ${Math.round(result.median.lcpMs)} | ${result.median.cls.toFixed(3)} | ${Math.round(result.median.tbtMs)} | ${Math.round(result.median.bytes)} |`);
  lines.push("", "Artifact limitado a métricas e rotas permitidas. Sem login, cookies, tokens, screenshots, headers ou URLs de terceiros. Não mede catálogo autenticado, carga nem produção.");
  const summary = `${lines.join("\n")}\n`;
  fs.writeFileSync(path.join(output, "summary.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
} catch {
  fs.writeFileSync(path.join(directory, "failure.json"), JSON.stringify({ stage }));
  const summary = `## Lighthouse\n\nExecução reprovada na etapa \`${stage}\`. Logs e relatórios brutos permanecem no diretório local de diagnóstico.\n`;
  fs.writeFileSync(path.join(output, "summary.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.error(`Medição Lighthouse reprovada na etapa: ${stage}.`);
  process.exitCode = 1;
} finally {
  if (browser) {
    try { await browser.close(); } catch { process.exitCode = 1; }
  }
  if (composeStarted) {
    if (process.exitCode) {
      const logs = spawnSync("docker", [...compose, "logs", "--no-color", "--tail", "80", "app"], { env: dockerEnv, encoding: "utf8", windowsHide: true, timeout: 20000 });
      fs.writeFileSync(path.join(directory, "private-app.log"), `${logs.stdout || ""}\n${logs.stderr || ""}`);
    }
    const cleanup = spawnSync("docker", [...compose, "down", "--volumes", "--remove-orphans"], { env: dockerEnv, encoding: "utf8", windowsHide: true, timeout: 60000 });
    fs.writeFileSync(path.join(directory, "cleanup.log"), `${cleanup.stdout || ""}\n${cleanup.stderr || ""}`);
    if (cleanup.error || cleanup.status !== 0) {
      console.error("Lighthouse: falha ao remover o ambiente descartável (cleanup).");
      process.exitCode = 1;
    }
  }
  fs.unlinkSync(envFile);
}
