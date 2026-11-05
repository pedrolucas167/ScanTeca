import assert from "node:assert/strict";
import test from "node:test";
import { scannerArguments, owaspImage, nvdDatafeed, reportSummary, dependencyInstallArguments, npmAuditSummary } from "./owasp-policy.mjs";

test("scanner fixa digest e monta somente manifests em leitura, cache e saída separados", () => {
  const args = scannerArguments({ input: "/fixture", output: "/reports", data: "/cache", name: "scanteca-owasp-123", user: "1001:1001" });
  assert.match(owaspImage, /:13\.0\.0@sha256:[a-f0-9]{64}$/u);
  assert.ok(args.includes("type=bind,source=/fixture,target=/input,readonly"));
  assert.ok(args.includes("type=bind,source=/reports,target=/output"));
  assert.ok(args.includes("type=bind,source=/cache,target=/data"));
  assert.ok(args.includes(nvdDatafeed));
  assert.equal(args.includes("--noupdate"), false);
  assert.equal(args.includes("--disableNodeAudit"), false);
  assert.equal(args.some(value => value.includes(".env")), false);
  assert.equal(args[args.indexOf("--user") + 1], "1001:1001");
  assert.equal(args[args.indexOf("--scan") + 1], "/input/package-lock.json");
});

test("instalação isolada usa lockfile, inclui dev e nunca executa scripts de dependências", () => {
  const args = dependencyInstallArguments("/fixture");
  assert.equal(args[0], "ci");
  assert.ok(args.includes("--ignore-scripts"));
  assert.ok(args.includes("--include=dev"));
  assert.equal(args[args.indexOf("--prefix") + 1], "/fixture");
});

test("nomes de containers externos não podem ser usados na limpeza", () => {
  assert.throws(() => scannerArguments({ name: "production" }));
});

test("identidade do runner aceita somente UID e GID numéricos", () => {
  assert.throws(() => scannerArguments({ name: "scanteca-owasp-123", user: "host:unexpected" }));
});

const sarif = { version: "2.1.0", runs: [{ tool: { driver: { name: "OWASP Dependency-Check" } } }] };

test("auditoria npm mantém achados moderados visíveis independentemente do OWASP", () => {
  const counts = { info: 0, low: 0, moderate: 8, high: 0, critical: 0, total: 8 };
  assert.deepEqual(npmAuditSummary({ metadata: { vulnerabilities: counts } }), counts);
});

test("erro, métricas ausentes ou contagens inconsistentes da auditoria npm reprovam", () => {
  for (const report of [null, {}, { error: { code: "EFAIL" } },
    { metadata: { vulnerabilities: { info: 0, low: 0, moderate: 8, high: 0, critical: 0, total: 0 } } },
    { metadata: { vulnerabilities: { info: 0, low: 0, moderate: -1, high: 0, critical: 0, total: -1 } } }]) {
    assert.throws(() => npmAuditSummary(report));
  }
});
const valid = { scanInfo: { engineVersion: "13.0.0" }, dependencies: [{ vulnerabilities: [{ name: "CVE-fixture", severity: "HIGH" }] }, { vulnerabilities: [{ name: "CVE-fixture", severity: "HIGH" }, { name: "CVE-other", severity: "CRITICAL" }] }] };

test("relatório deduplica achados e mantém severidades visíveis em modo informativo", () => {
  assert.deepEqual(reportSummary(valid, sarif), { components: 2, vulnerabilities: 2, critical: 1, high: 1 });
});

test("resultado vazio, engine incorreto ou SARIF inválido nunca são aprovação", () => {
  assert.throws(() => reportSummary({ ...valid, dependencies: [] }, sarif));
  assert.throws(() => reportSummary({ ...valid, scanInfo: {} }, sarif));
  assert.throws(() => reportSummary(valid, { version: "2.1.0", runs: [] }));
  assert.throws(() => reportSummary(valid, null));
  assert.throws(() => reportSummary(valid, { version: "2.1.0", runs: [{}] }));
});
