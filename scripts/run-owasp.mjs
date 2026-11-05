import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { scannerArguments, reportSummary } from "./owasp-policy.mjs";

const reports = path.resolve("reports");
const output = path.join(reports, "security", "owasp");
const data = path.join(reports, "security", "owasp-data-v13");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(data, { recursive: true });
const input = fs.mkdtempSync(path.join(reports, "owasp-input-"));
const name = `scanteca-owasp-${process.pid}`;
let invoked = false;
try {
  // Do not let old output satisfy verification after a subsequent incomplete run.
  for (const file of ["dependency-check-report.html", "dependency-check-report.json", "dependency-check-report.sarif", "summary.md"]) fs.rmSync(path.join(output, file), { force: true });
  // Only public dependency manifests; never mount .env, .git or the whole workspace.
  for (const [source, destination] of [["package.json", "package.json"], ["package-lock.json", "package-lock.json"], [".github/dependency-check-suppressions.xml", "dependency-check-suppressions.xml"]]) {
    if (!fs.lstatSync(source).isFile()) throw new Error("O scanner exige manifests e suppressions como arquivos regulares.");
    fs.copyFileSync(source, path.join(input, destination));
  }
  invoked = true;
  // mkdtemp is owner-only on Linux; use that same owner inside the non-privileged container.
  const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  const result = spawnSync("docker", scannerArguments({ input, output, data, name, user }), { stdio: "inherit", windowsHide: true, timeout: 35 * 60 * 1000 });
  if (result.error || result.status !== 0) throw new Error("O scanner OWASP falhou. Confira atualização NVD, conectividade e logs. Relatórios parciais não são aprovação.");
  for (const extension of ["html", "json", "sarif"]) {
    const file = path.join(output, `dependency-check-report.${extension}`);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Relatório ${extension.toUpperCase()} não foi gerado.`);
  }
  const summary = reportSummary(JSON.parse(fs.readFileSync(path.join(output, "dependency-check-report.json"), "utf8")), JSON.parse(fs.readFileSync(path.join(output, "dependency-check-report.sarif"), "utf8")));
  const message = `## OWASP Dependency-Check\n\nScanner executado; relatórios HTML, JSON e SARIF verificados.\n\n| Componentes | Vulnerabilidades únicas | Críticas | Altas |\n| ---: | ---: | ---: | ---: |\n| ${summary.components} | ${summary.vulnerabilities} | ${summary.critical} | ${summary.high} |\n\nModo informativo: achados são publicados sem bloquear por severidade. Falhas do scanner, de atualização ou relatórios inválidos reprovam o job. Sonatype OSS Index não é consultado; NVD e npm audit permanecem ativos.\n`;
  fs.writeFileSync(path.join(output, "summary.md"), message);
  process.stdout.write(message);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
} catch (error) {
  fs.writeFileSync(path.join(output, "summary.md"), "## OWASP Dependency-Check\n\n**Execução reprovada.** O scanner ou a verificação dos relatórios falhou. Consulte os logs do job; qualquer relatório parcial não constitui aprovação.\n");
  process.stderr.write(`::error title=OWASP Dependency-Check::${String(error.message).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}\n`);
  process.exitCode = 1;
} finally {
  if (invoked) spawnSync("docker", ["rm", "--force", name], { stdio: "ignore", windowsHide: true, timeout: 15000 });
  const relative = path.relative(fs.realpathSync(reports), fs.realpathSync(input));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Limpeza temporária fora do diretório permitido.");
  fs.rmSync(input, { recursive: true, force: true });
}
