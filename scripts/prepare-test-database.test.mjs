import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("recusa destinos fora do banco descartável antes de executar Prisma", () => {
  for (const url of ["", "postgresql://production.invalid:55439/scanteca_reading_test", "postgresql://127.0.0.1:5432/scanteca_reading_test", "postgresql://127.0.0.1:55439/production", "postgresql://127.0.0.1:55439/scanteca_reading_test?host=production.invalid"]) {
    const result = spawnSync(process.execPath, ["scripts/prepare-test-database.mjs"], { env: { ...process.env, SCANTECA_TEST_DATABASE_URL: url }, encoding: "utf8", timeout: 5000, windowsHide: true });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Defina SCANTECA_TEST_DATABASE_URL|Preparação permite somente/u);
    assert.equal(result.stdout.includes("Prisma schema"), false);
  }
});
