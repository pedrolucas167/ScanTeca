import assert from "node:assert/strict";
import test from "node:test";
import { scannerArguments, owaspImage, nvdDatafeed, reportSummary } from "./owasp-policy.mjs";

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
});

test("nomes de containers externos não podem ser usados na limpeza", () => {
  assert.throws(() => scannerArguments({ name: "production" }));
});

test("identidade do runner aceita somente UID e GID numéricos", () => {
  assert.throws(() => scannerArguments({ name: "scanteca-owasp-123", user: "host:unexpected" }));
});

const sarif = { version: "2.1.0", runs: [{ tool: { driver: { name: "OWASP Dependency-Check" } } }] };
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
