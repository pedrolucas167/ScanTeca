import { spawnSync } from "node:child_process";

const database = "postgresql://scanteca_test:scanteca_migration_local@127.0.0.1:55440/scanteca_migration_test";
const env = { ...process.env, SCANTECA_MIGRATION_DATABASE_URL: database, DATABASE_URL: database };
const compose = ["compose", "--project-name", `scanteca-migrations-${process.pid}`, "--file", "docker/compose.migrations.yml"];
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("Validação de migrations reprovada; veja as anotações acima.");
}
let cleanup = false;
try {
  run(process.execPath, ["scripts/check-migration-history.mjs"]);
  cleanup = true;
  run("docker", [...compose, "up", "--detach", "--wait"]);
  run(process.execPath, ["scripts/check-migration-sql.mjs"]);
  run(process.execPath, ["--test", "scripts/migration-sql.integration.test.mjs"]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (cleanup) {
    const result = spawnSync("docker", [...compose, "down", "--volumes"], { env, stdio: "inherit", windowsHide: true });
    if (result.error || result.status !== 0) process.exitCode = 1;
  }
}
