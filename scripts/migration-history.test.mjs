import assert from "node:assert/strict";
import test from "node:test";
import { inspectMigrationHistory, annotation } from "./migration-history.mjs";
import { migrationDatabase } from "./check-migration-sql.mjs";

const initial = "prisma/migrations/20261105090000_init/migration.sql";
const next = "prisma/migrations/20261105100000_add_notes/migration.sql";
const snapshot = () => new Map([[initial, "CREATE TABLE test (id int);\n"], ["prisma/migrations/migration_lock.toml", 'provider = "postgresql"\n'], ["prisma/schema.prisma", "schema"]]);
const codes = (base, current) => inspectMigrationHistory(base, current).errors.map(error => error.code);

test("aceita timestamps distintos com intervalos e detecta quando SQL precisa executar", () => {
  const base = snapshot(), current = snapshot();
  assert.equal(inspectMigrationHistory(base, current).needsReplay, false);
  current.set(next, "ALTER TABLE test ADD notes text;");
  const result = inspectMigrationHistory(base, current);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.added, [next]);
  assert.equal(result.needsReplay, true);
});

test("duas pastas de mesmo timestamp falham mesmo com descrições diferentes", () => {
  const current = snapshot();
  current.set(initial.replace("_init", "_other"), "SELECT 1;");
  assert.ok(codes(snapshot(), current).includes("DUPLICATE_VERSION"));
});

test("alterar, excluir ou renomear migration integrada exige restauração", () => {
  const current = snapshot();
  current.set(initial, "SELECT 1;");
  assert.ok(codes(snapshot(), current).includes("HISTORY_CHANGED"));
  current.delete(initial);
  current.set(next, "SELECT 1;");
  assert.ok(codes(snapshot(), current).includes("HISTORY_DELETED"));
});

test("inserção anterior à última versão integrada falha", () => {
  const current = snapshot();
  current.set("prisma/migrations/20261104000000_late/migration.sql", "SELECT 1;");
  assert.ok(codes(snapshot(), current).includes("OUT_OF_ORDER"));
});

test("nome, data, arquivo ausente e SQL vazio recebem diagnósticos específicos", () => {
  for (const [file, sql, expected] of [
    ["prisma/migrations/V5__invalid.sql", "SELECT 1;", "LOOSE_SQL"],
    ["prisma/migrations/20260230000000_invalid/migration.sql", "SELECT 1;", "INVALID_TIMESTAMP"],
    ["prisma/migrations/20261106000000_empty/migration.sql", "\n", "EMPTY_SQL"],
    ["prisma/migrations/20261106000000_missing/readme.md", "doc", "MISSING_SQL"],
    ["prisma/migrations/no_timestamp/migration.sql", "SELECT 1;", "INVALID_NAME"],
  ]) {
    const current = snapshot(); current.set(file, sql);
    assert.ok(codes(snapshot(), current).includes(expected), expected);
  }
});

test("schema alterado sem migration também exige comparação no PostgreSQL", () => {
  const current = snapshot(); current.set("prisma/schema.prisma", "changed schema");
  assert.equal(inspectMigrationHistory(snapshot(), current).needsReplay, true);
});

test("SQL solto legado é avisado e protegido; novo SQL solto falha", () => {
  const base = snapshot(); base.set("prisma/migrations/legacy.sql", "SELECT 1;");
  const current = new Map(base);
  assert.equal(inspectMigrationHistory(base, current).warnings.length, 1);
  assert.deepEqual(codes(base, current), []);
  current.set("prisma/migrations/legacy.sql", "SELECT 2;");
  assert.ok(codes(base, current).includes("HISTORY_CHANGED"));
});

test("lock do provider é obrigatório e imutável", () => {
  const current = snapshot(); current.delete("prisma/migrations/migration_lock.toml");
  assert.ok(codes(snapshot(), current).includes("MISSING_LOCK"));
});

test("conversão CRLF do checkout não simula alteração de SQL", () => {
  const current = snapshot(); current.set(initial, current.get(initial).replaceAll("\n", "\r\n"));
  assert.deepEqual(codes(snapshot(), current), []);
});

test("anotações escapam comandos injetados em nomes e mensagens", () => {
  const result = annotation("error", { file: "file,other=x\n::warning::bad", message: "erro\n::error::injetado%" });
  assert.equal(result.includes("\n"), false);
  assert.match(result, /%2C/u);
  assert.match(result, /%0A/u);
  assert.match(result, /%25/u);
});

test("recusa produção, parâmetros, fragmentos, porta e database errados antes do Prisma", () => {
  for (const value of [undefined, "postgresql://production.invalid/db", "postgresql://127.0.0.1:55440/production", "postgresql://127.0.0.1:5432/scanteca_migration_test", "postgresql://127.0.0.1:55440/scanteca_migration_test?host=production.invalid", "postgresql://127.0.0.1:55440/scanteca_migration_test#extra"]) {
    assert.throws(() => migrationDatabase({ SCANTECA_MIGRATION_DATABASE_URL: value }));
  }
  assert.equal(migrationDatabase({ SCANTECA_MIGRATION_DATABASE_URL: "postgresql://test:test@127.0.0.1:55440/scanteca_migration_test" }), "postgresql://test:test@127.0.0.1:55440/scanteca_migration_test");
});
