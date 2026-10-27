import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { isPrivateEnvFile } from "./secret-policy.mjs";

const staged = process.argv.includes("--staged");
const binary = process.env.GITLEAKS_BIN || "gitleaks";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "scanteca-secret-scan-"));
try {
  const tracked = spawnSync("git", ["ls-files", "--cached", "-z"], { encoding: "utf8", windowsHide: true });
  if (tracked.status !== 0) throw new Error("Não foi possível verificar arquivos versionados.");
  if (tracked.stdout.split("\0").some(isPrivateEnvFile)) throw new Error("Arquivo de ambiente privado no index. Remova-o do Git; somente .env.example pode ser versionado.");
  const report = path.join(directory, "findings.json");
  const args = ["git", ".", "--config", ".gitleaks.toml", "--redact=100", "--no-banner", "--log-level=error", "--ignore-gitleaks-allow", "--timeout=120", "--report-format=json", "--report-path", report,
    ...(staged ? ["--pre-commit", "--staged"] : ["--log-opts=--all"])];
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 130000, windowsHide: true });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("Scanner indisponível ou execução inválida. Instale Gitleaks 8.30.1 ou configure GITLEAKS_BIN.");
  if (!fs.existsSync(report)) throw new Error("Scanner não produziu relatório; verificação bloqueada.");
  const findings = JSON.parse(fs.readFileSync(report, "utf8"));
  if (!Array.isArray(findings)) throw new Error("Formato de relatório inválido.");
  if (result.status === 1 && findings.length === 0) throw new Error("Scanner falhou sem relatório válido.");
  for (const finding of findings) {
    // Não imprime o trecho de código, o valor encontrado ou dados do autor.
    const file = String(finding.File).replace(/[\r\n\u001b]/gu, "");
    console.error(`Segredo potencial: ${finding.RuleID}; ${file}:${finding.StartLine}`);
  }
  if (findings.length) {
    console.error(`Bloqueado: ${findings.length} achado(s). Remova o segredo e, se real, revogue-o antes de prosseguir.`);
    process.exitCode = 1;
  } else process.stdout.write(`Verificação de segredos aprovada (${staged ? "index" : "histórico completo"}).\n`);
} catch (error) {
  console.error(error instanceof SyntaxError ? "Relatório de segredos inválido." : error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(path.join(directory, "findings.json"), { force: true });
  fs.rmdirSync(directory);
}
