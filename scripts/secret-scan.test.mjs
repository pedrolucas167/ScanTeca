import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isPrivateEnvFile } from "./secret-policy.mjs";

const binary = process.env.GITLEAKS_BIN || "gitleaks";
test("impede arquivos de ambiente privados, inclusive em subpastas", () => {
  for (const file of [".env", ".env.local", "nested/.env.production", "nested\\.env.test"]) assert.equal(isPrivateEnvFile(file), true);
  for (const file of [".env.example", "nested/.env.example", "dotenv.ts", "environment.md"]) assert.equal(isPrivateEnvFile(file), false);
});
function scan(input) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scanteca-secret-test-"));
  const report = path.join(directory, "report.json");
  try {
    const result = spawnSync(binary, ["stdin", "--config", ".gitleaks.toml", "--redact=100", "--no-banner", "--log-level=error", "--report-format=json", "--report-path", report], { input, encoding: "utf8", timeout: 15000, windowsHide: true });
    assert.equal(Boolean(result.error), false, "Scanner precisa estar instalado");
    const json = fs.readFileSync(report, "utf8");
    return { status: result.status, findings: JSON.parse(json), json, output: result.stdout + result.stderr };
  } finally {
    fs.rmSync(report, { force: true });
    fs.rmdirSync(directory);
  }
}

test("bloqueia chave privada Clerk sintética e oculta o valor", () => {
  const synthetic = ["sk", "test", "aB9xQ2mN8rT4vY6uI3oP5sD7fG1hJ0kL"].join("_");
  const result = scan(`CLERK_SECRET_KEY=${synthetic}`);
  assert.equal(result.status, 1);
  assert.ok(result.findings.some(finding => finding.RuleID === "clerk-secret-key"));
  assert.equal((result.json + result.output).includes(synthetic), false, "Resultados devem ocultar valores");
});

test("bloqueia senha embutida na conexão e permite somente a senha descartável", () => {
  const password = ["synthetic", "Private", "41"].join("");
  assert.equal(scan(`DATABASE_URL=postgresql://test:${password}@example.invalid/db`).status, 1);
  assert.equal(scan("DATABASE_URL=postgresql://scanteca_test:scanteca_test_local@127.0.0.1:55439/scanteca_reading_test").status, 0);
});

test("aceita placeholders e a chave pública fictícia exata do build", () => {
  const publicDummy = "pk_test_" + Buffer.from("dummy.clerk.accounts.dev$").toString("base64").replace(/=+$/u, "");
  assert.equal(scan(`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publicDummy}\nCLERK_SECRET_KEY=<configure-no-secret>`).status, 0);
});

test("reprova quando o scanner não pode ser executado", () => {
  const result = spawnSync(process.execPath, ["scripts/secret-scan.mjs"], { env: { ...process.env, GITLEAKS_BIN: path.resolve("scanner-inexistente") }, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Scanner indisponível/u);
});
