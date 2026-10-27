import fs from "node:fs";
import path from "node:path";
import coverage from "istanbul-lib-coverage";
import report from "istanbul-lib-report";
import reports from "istanbul-reports";
import { findRegressions, metrics } from "./coverage-policy.mjs";

try {
  const root = process.cwd();
  const inputs = ["unit", "integration"].map(suite => {
    const filename = path.join(root, "coverage", suite, "coverage-final.json");
    return coverage.createCoverageMap(JSON.parse(fs.readFileSync(filename, "utf8")));
  });
  const files = inputs[0].files().sort();
  if (files.length === 0 || JSON.stringify(files) !== JSON.stringify(inputs[1].files().sort())) {
    throw new Error("As duas suítes devem medir o mesmo conjunto não vazio de arquivos.");
  }
  const combined = coverage.createCoverageMap({});
  for (const input of inputs) combined.merge(input);
  const directory = path.join(root, "coverage", "combined");
  fs.mkdirSync(directory, { recursive: true });
  const context = report.createContext({ dir: directory, coverageMap: combined });
  for (const type of ["json", "json-summary", "html"]) reports.create(type).execute(context);
  const summary = combined.getCoverageSummary().toJSON();
  const format = value => `${value.toFixed(2).replace(".", ",")}%`;
  const rows = metrics.map(metric => `| ${metric} | ${format(summary[metric].pct)} | ${summary[metric].covered}/${summary[metric].total} |`);
  const markdown = [
    "## Cobertura combinada",
    "",
    `Suíte principal + integração, incluindo ${files.length} arquivos de aplicação, mesmo sem testes.`,
    "",
    "| Métrica | Cobertura | Cobertos/total |",
    "| --- | ---: | ---: |",
    ...rows,
    "",
    "### Cobertura de linhas por área",
    "",
    "| Área | Cobertura |",
    "| --- | ---: |",
  ];
  for (const area of ["app", "components", "lib", "modules"]) {
    const subset = coverage.createCoverageMap({});
    for (const file of files) {
      if (path.relative(root, file).split(path.sep)[0] === area) subset.addFileCoverage(combined.fileCoverageFor(file));
    }
    markdown.push(`| ${area} | ${format(subset.getCoverageSummary().lines.pct)} |`);
  }
  let regressions = [];
  if (process.argv.includes("--check")) {
    const minimums = JSON.parse(fs.readFileSync(path.join(root, "coverage-baseline.json"), "utf8"));
    regressions = findRegressions(summary, minimums);
    markdown.push("", regressions.length ? "**Reprovado: cobertura abaixo da base versionada.**" : "**Aprovado: cobertura atende à base versionada.**");
    for (const item of regressions) markdown.push(`- ${item.metric}: ${format(item.actual)}; mínimo ${format(item.minimum)}.`);
  }
  const output = `${markdown.join("\n")}\n`;
  fs.writeFileSync(path.join(directory, "summary.md"), output);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
  process.stdout.write(output);
  if (regressions.length) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Falha ao consolidar a cobertura."}\n`);
  process.exitCode = 1;
}
