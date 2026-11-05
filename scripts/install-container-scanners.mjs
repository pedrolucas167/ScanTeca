import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { scannerReleases } from "./container-security-policy.mjs";

if (process.arch !== "x64" || !["linux", "win32"].includes(process.platform)) throw new Error("Scanners suportados em Linux/Windows x64.");
for (const [name, release] of Object.entries(scannerReleases)) {
  const directory = path.resolve("reports", "tools", "container-security", `${name}-${release.version}`);
  fs.mkdirSync(directory, { recursive: true });
  const windows = process.platform === "win32";
  const asset = `${name}_${release.version}_${windows ? "windows" : "linux"}_amd64.${windows ? "zip" : "tar.gz"}`;
  const response = await fetch(`https://github.com/anchore/${name}/releases/download/v${release.version}/${asset}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Download de ${name} reprovado.`);
  const content = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(content).digest("hex") !== release[process.platform]) throw new Error(`Checksum de ${name} não confere.`);
  const archive = path.join(directory, asset);
  fs.writeFileSync(archive, content);
  const result = windows
    ? spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", "Expand-Archive -LiteralPath $env:SCANTECA_SCANNER_ARCHIVE -DestinationPath $env:SCANTECA_SCANNER_DIRECTORY -Force"], { env: { ...process.env, SCANTECA_SCANNER_ARCHIVE: archive, SCANTECA_SCANNER_DIRECTORY: directory }, windowsHide: true })
    : spawnSync("tar", ["-xzf", archive, "-C", directory, name]);
  if (result.error || result.status !== 0) throw new Error(`Extração de ${name} reprovada.`);
  fs.unlinkSync(archive);
  if (process.env.GITHUB_PATH) fs.appendFileSync(process.env.GITHUB_PATH, `${directory}\n`);
  process.stdout.write(`${name} ${release.version}: download e SHA-256 verificados.\n`);
}
