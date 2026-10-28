import { spawnSync } from "node:child_process";

const raw = process.env.SCANTECA_TEST_DATABASE_URL;
if (!raw) throw new Error("Defina SCANTECA_TEST_DATABASE_URL para o banco descartável.");
const url = new URL(raw);
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test" || url.search) throw new Error("Preparação permite somente o banco descartável documentado.");
const env = { ...process.env, DATABASE_URL: raw };
for (const args of [["db", "execute", "--file", "prisma/local-extensions.sql"], ["db", "push"]]) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { env, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
