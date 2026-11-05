import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { annotation, readMigrationComparison } from "./migration-history.mjs";

export function migrationDatabase(environment) {
  const raw = environment.SCANTECA_MIGRATION_DATABASE_URL;
  if (!raw) throw new Error("Defina SCANTECA_MIGRATION_DATABASE_URL para o PostgreSQL descartável de migrations.");
  const url = new URL(raw);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || url.port !== "55440" || url.pathname !== "/scanteca_migration_test" || url.search || url.hash) throw new Error("CI de migrations permite somente 127.0.0.1:55440/scanteca_migration_test, sem parâmetros.");
  return raw;
}

export function checkMigrationSql(snapshot) {
  // Validate destination before invoking Prisma or loading dotenv configuration.
  const database = migrationDatabase(process.env);
  const comparison = snapshot ?? readMigrationComparison();
  if (comparison.errors.length) throw new Error("Histórico inválido. Execute primeiro npm run migrations:check e corrija as anotações.");
  fs.mkdirSync("reports", { recursive: true });
  const temporary = fs.mkdtempSync(path.resolve("reports/migration-ci-"));
  const env = { ...process.env, DATABASE_URL: database };
  const config = path.join(temporary, "prisma.config.ts");
  const run = (args, message) => {
    const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args, "--config", config], { env, encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      const error = new Error(message);
      const name = `${result.stdout}\n${result.stderr}`.match(/Migration name:\s*(\d{14}_[a-z0-9_]+)/u)?.[1];
      if (name) error.file = `prisma/migrations/${name}/migration.sql`;
      throw error;
    }
    return result.stdout;
  };
  try {
    fs.mkdirSync(path.join(temporary, "migrations", "00000000000000_ci_base"), { recursive: true });
    fs.writeFileSync(path.join(temporary, "base.prisma"), comparison.base.get("prisma/schema.prisma"));
    fs.writeFileSync(path.join(temporary, "head.prisma"), comparison.current.get("prisma/schema.prisma"));
    fs.writeFileSync(config, 'import { defineConfig } from "prisma/config";\nexport default defineConfig({ schema: "base.prisma", migrations: { path: "migrations" }, datasource: { url: process.env.DATABASE_URL } });\n');
    fs.writeFileSync(path.join(temporary, "migrations", "migration_lock.toml"), 'provider = "postgresql"\n');
    const baseline = run(["migrate", "diff", "--from-empty", "--to-schema", path.join(temporary, "base.prisma"), "--script"], "Não foi possível gerar o schema-base de teste. Confira a configuração Prisma.");
    fs.writeFileSync(path.join(temporary, "migrations", "00000000000000_ci_base", "migration.sql"), baseline);
    for (const file of comparison.added) {
      const target = path.join(temporary, "migrations", path.basename(path.dirname(file)), "migration.sql");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, comparison.current.get(file));
    }
    run(["db", "execute", "--file", "prisma/local-extensions.sql"], "Não foi possível instalar pgvector no banco descartável.");
    run(["migrate", "deploy"], "SQL das migrations não pôde ser aplicado sobre o schema da branch de destino. Confira ordem, dependências, sintaxe e se a migration inclui a alteração desejada.");
    run(["migrate", "status"], "O histórico aplicado no banco descartável ficou incompleto ou contém uma migration com falha.");
    run(["migrate", "diff", "--from-config-datasource", "--to-schema", path.join(temporary, "head.prisma"), "--exit-code"], "O resultado das migrations difere de schema.prisma. Há alteração de schema sem migration, SQL incompleto ou falha na comparação. Gere a migration faltante e confira seu conteúdo.");
    const summary = "SQL aprovado: schema-base da branch de destino + novas migrations correspondem ao schema do PR, em PostgreSQL descartável.";
    process.stdout.write(`${summary}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## SQL das migrations\n\n${summary}\n\nBase reconstruída do schema; não é replay integral do SQL histórico nem validação de dados de produção.\n`);
  } finally {
    // Only files created by this invocation, inside its own fixed temporary directory.
    const relative = path.relative(fs.realpathSync("reports"), fs.realpathSync(temporary));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Diretório temporário fora do destino de limpeza permitido.");
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { checkMigrationSql(); }
  catch (error) { console.error(annotation("error", { file: error.file, message: error.message })); process.exitCode = 1; }
}
