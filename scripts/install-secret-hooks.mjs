import { spawnSync } from "node:child_process";

const existing = spawnSync("git", ["config", "--local", "--get", "core.hooksPath"], { encoding: "utf8", windowsHide: true });
if (![0, 1].includes(existing.status)) throw new Error("Não foi possível ler a configuração local do Git.");
if (existing.status === 0 && existing.stdout.trim() !== ".githooks") throw new Error("Já existem hooks configurados. Integre os hooks de segredos ao fluxo existente antes de alterar core.hooksPath.");
const result = spawnSync("git", ["config", "--local", "core.hooksPath", ".githooks"], { stdio: "inherit", windowsHide: true });
if (result.status !== 0) process.exitCode = 1;
else process.stdout.write("Hooks de segredos ativados para este repositório local. Instale Gitleaks 8.30.1 antes de commitar ou enviar.\n");
