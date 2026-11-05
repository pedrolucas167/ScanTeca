import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkMigrationSql, migrationDatabase } from "./check-migration-sql.mjs";
import { inspectMigrationHistory, readMigrationComparison } from "./migration-history.mjs";

// Separate fixed local test database. No dotenv or application database fallback.
const database = migrationDatabase(process.env);
const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: database }) });
async function resetDisposableSchema() {
  migrationDatabase(process.env);
  await client.$executeRawUnsafe('DROP SCHEMA IF EXISTS "public" CASCADE');
  await client.$executeRawUnsafe('CREATE SCHEMA "public"');
}
beforeEach(resetDisposableSchema);
after(async () => { try { await resetDisposableSchema(); } finally { await client.$disconnect(); } });

const probeFile = "prisma/migrations/20990101000000_ci_probe/migration.sql";
function probe(sql) {
  const { base } = readMigrationComparison();
  const current = new Map(base);
  current.set("prisma/schema.prisma", `${base.get("prisma/schema.prisma")}\nmodel MigrationCiProbe {\n  id Int @id\n}\n`);
  if (sql) current.set(probeFile, sql);
  return { base, current, ...inspectMigrationHistory(base, current) };
}

test("PostgreSQL aceita o schema-base sem alterações", () => {
  const { base } = readMigrationComparison();
  const current = new Map(base);
  assert.doesNotThrow(() => checkMigrationSql({ base, current, ...inspectMigrationHistory(base, current) }));
});

test("PostgreSQL aceita migration válida e confirma correspondência com o schema", () => {
  assert.doesNotThrow(() => checkMigrationSql(probe('CREATE TABLE "MigrationCiProbe" ("id" INTEGER NOT NULL, CONSTRAINT "MigrationCiProbe_pkey" PRIMARY KEY ("id"));')));
});

test("schema alterado sem SQL correspondente reprova com orientação amigável", () => {
  assert.throws(() => checkMigrationSql(probe()), /difere de schema.prisma/u);
});

test("SQL inválido reprova e aponta a migration responsável", () => {
  assert.throws(() => checkMigrationSql(probe('CREAT TABLE "MigrationCiProbe" (id INTEGER);')), error => {
    assert.match(error.message, /SQL das migrations não pôde ser aplicado/u);
    assert.equal(error.file, probeFile);
    return true;
  });
});
