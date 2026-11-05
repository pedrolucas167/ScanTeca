import fs from "node:fs";
import { annotation, readMigrationComparison } from "./migration-history.mjs";

try {
  const result = readMigrationComparison();
  for (const warning of result.warnings) process.stdout.write(`${annotation("warning", warning)}\n`);
  for (const error of result.errors) console.error(annotation("error", error));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `needs-replay=${result.needsReplay}\n`);
  const summary = result.errors.length
    ? `Histórico de migrações reprovado: ${result.errors.length} problema(s). Veja as anotações nos arquivos e restaure o histórico antes de gerar uma nova migração.`
    : `Histórico Prisma aprovado. ${result.added.length} migração(ões) nova(s). Versões são timestamps: intervalos entre datas são permitidos.`;
  process.stdout.write(`${summary}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Histórico de migrações Prisma\n\n${summary}\n\n${result.warnings.length} aviso(s) sobre SQL legado fora do histórico executável.\n`);
  if (result.errors.length) process.exitCode = 1;
} catch (error) {
  console.error(annotation("error", { message: error.message }));
  process.exitCode = 1;
}
