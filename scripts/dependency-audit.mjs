import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

try {
  if (!process.env.npm_execpath) throw new Error("Execute por npm run security:audit.");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--omit=dev", "--json"], {
    encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("Não foi possível obter a auditoria de dependências.");
  const data = JSON.parse(result.stdout);
  if (data.error || !data.metadata?.vulnerabilities) throw new Error("A auditoria não retornou métricas válidas.");
  const directory = path.join("reports", "security");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "audit.json"), JSON.stringify(data, null, 2));
  const counts = data.metadata.vulnerabilities;
  const lines = ["## Auditoria informativa de dependências de produção", "", "Este relatório não aprova a segurança nem aplica correções automáticas.", "", "| Severidade | Ocorrências |", "| --- | ---: |"];
  for (const severity of ["info", "low", "moderate", "high", "critical"]) lines.push(`| ${severity} | ${counts[severity] ?? 0} |`);
  const summary = `${lines.join("\n")}\n`;
  fs.writeFileSync(path.join(directory, "summary.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(summary);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Falha na auditoria."}\n`);
  process.exitCode = 1;
}
