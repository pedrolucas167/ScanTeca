import { spawnSync } from "node:child_process";

const url = new URL(process.env.DATABASE_URL || "invalid:");
if (url.protocol !== "postgresql:" || url.hostname !== "database" || url.port !== "5432"
  || url.username !== "scanteca_dev" || url.pathname !== "/scanteca_container_dev" || url.search) {
  throw new Error("Preparação permitida somente no banco local do Compose de containers.");
}
// Local schema snapshot only. Never present legacy SQL as a replayable migration history.
for (const args of [["db", "execute", "--file", "prisma/local-extensions.sql"], ["db", "push"]]) {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { stdio: "inherit", timeout: 120000 });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
