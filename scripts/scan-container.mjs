import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { scannerReleases, summarizeImageSecurity } from "./container-security-policy.mjs";

const output = path.resolve("reports/security/container");
fs.mkdirSync(output, { recursive: true });
const file = name => path.join(output, name);
const environment = { ...process.env };
for (const name of Object.keys(environment)) if (/^(SYFT|GRYPE)_/u.test(name)) delete environment[name];
Object.assign(environment, { SYFT_CHECK_FOR_APP_UPDATE: "false", GRYPE_CHECK_FOR_APP_UPDATE: "false",
  GRYPE_DB_CACHE_DIR: path.resolve("reports/security/grype-db"), GRYPE_DB_AUTO_UPDATE: "true", GRYPE_DB_VALIDATE_AGE: "true", GRYPE_DB_MAX_ALLOWED_BUILT_AGE: "120h" });
const binary = name => path.resolve("reports/tools/container-security", `${name}-${scannerReleases[name].version}`, `${name}${process.platform === "win32" ? ".exe" : ""}`);
function run(command, args, capture = false) {
  const result = spawnSync(command, args, { env: environment, stdio: capture ? "pipe" : "inherit", encoding: "utf8", windowsHide: true, timeout: 10 * 60 * 1000 });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(command)} falhou (status ${result.status}, ${result.error?.code || "sem erro de inicialização"}). Relatórios parciais não aprovam a imagem.`);
  return result.stdout?.trim();
}
const read = name => JSON.parse(fs.readFileSync(file(name), "utf8"));
try {
  for (const name of ["sbom.syft.json", "sbom.cdx.json", "grype.json", "grype.sarif", "summary.md", "image.json"]) fs.rmSync(file(name), { force: true });
  const inspected = JSON.parse(run("docker", ["image", "inspect", "scanteca-container:test", "--format", "{{json .}}"], true));
  const id = inspected.Id;
  if (!/^sha256:[a-f0-9]{64}$/u.test(id)) throw new Error("Identidade da imagem inválida.");
  fs.writeFileSync(file("scanner.yaml"), "check-for-app-update: false\n");
  run(binary("syft"), ["scan", `docker:${id}`, "--config", file("scanner.yaml"), "--output", `syft-json=${file("sbom.syft.json")}`, "--output", `cyclonedx-json=${file("sbom.cdx.json")}`]);
  run(binary("grype"), ["db", "update", "--config", file("scanner.yaml")]);
  environment.GRYPE_DB_AUTO_UPDATE = "false";
  run(binary("grype"), [`sbom:${file("sbom.syft.json")}`, "--config", file("scanner.yaml"), "--output", `json=${file("grype.json")}`, "--output", `sarif=${file("grype.sarif")}`]);
  const sbom = read("sbom.syft.json");
  if (sbom.source?.type !== "image" || sbom.source.metadata?.userInput !== id) throw new Error("O inventário não corresponde à imagem inspecionada.");
  const result = summarizeImageSecurity(sbom, read("grype.json"), read("sbom.cdx.json"), read("grype.sarif"));
  const imageIdentity = { architecture: inspected.Architecture, os: inspected.Os, layers: inspected.RootFS.Layers, config: inspected.Config };
  fs.writeFileSync(file("image.json"), JSON.stringify({ imageId: id, imageIdentity, scanners: scannerReleases, result }, null, 2));
  const message = `## Segurança da imagem\n\nInventário: ${result.components} componentes. Achados por componente/advisory: ${result.findings}; altos: ${result.high}; críticos: ${result.critical}.\n\nBloqueios altos/críticos com correção disponível: **${result.blockers.length}**.\n\n${result.blockers.map(item => `- ${item.id}: ${item.package} ${item.version} → ${item.fixes.join(", ")}`).join("\n")}\n\nTodos os achados permanecem no JSON/SARIF, inclusive sem correção. A ausência de bloqueios não significa ausência de vulnerabilidades.\n`;
  fs.writeFileSync(file("summary.md"), message);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
  process.stdout.write(message);
  if (result.blockers.length) throw new Error("Publicação bloqueada por vulnerabilidades altas/críticas com correção disponível.");
} catch (error) {
  if (!fs.existsSync(file("summary.md"))) fs.writeFileSync(file("summary.md"), "## Segurança da imagem\n\nExecução reprovada: scanner ou relatórios inválidos. Consulte os logs.\n");
  console.error(error.message);
  process.exitCode = 1;
}
