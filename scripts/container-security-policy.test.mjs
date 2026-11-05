import assert from "node:assert/strict";
import test from "node:test";
import { scannerReleases, summarizeImageSecurity } from "./container-security-policy.mjs";

const sbom = { descriptor: { name: "syft", version: scannerReleases.syft.version }, artifacts: [{ id: "os", type: "deb" }, { id: "app", type: "npm" }] };
const cyclonedx = { bomFormat: "CycloneDX", components: [{}] };
const sarif = { version: "2.1.0", runs: [{ tool: { driver: { name: "grype" } } }] };
const finding = (severity, state, id = "CVE-fixture") => ({ artifact: { id: "os", name: "fixture", version: "1" }, vulnerability: { id, severity, fix: { state, versions: state === "fixed" ? ["2"] : [] } } });
const report = matches => ({ descriptor: { name: "grype", version: scannerReleases.grype.version }, matches });
const summarize = (matches, inventory = sbom) => summarizeImageSecurity(inventory, report(matches), cyclonedx, sarif);

test("bloqueia altos e críticos com correção, sem ocultar os demais achados", () => {
  const result = summarize([finding("High", "fixed"), finding("Critical", "not-fixed", "CVE-unfixed"), finding("Medium", "fixed", "CVE-medium")]);
  assert.equal(result.findings, 3);
  assert.equal(result.critical, 1);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].id, "CVE-fixture");
});
test("deduplica o mesmo advisory no mesmo componente", () => {
  assert.equal(summarize([finding("High", "fixed"), finding("High", "fixed")]).blockers.length, 1);
});
test("duplicata posterior não rebaixa severidade nem oculta correção disponível", () => {
  const result = summarize([finding("Critical", "fixed"), finding("Low", "not-fixed")]);
  assert.equal(result.findings, 1);
  assert.equal(result.critical, 1);
  assert.equal(result.blockers.length, 1);
});
test("ausência de achados exige inventário válido, incluindo sistema e aplicação", () => {
  assert.equal(summarize([]).findings, 0);
  for (const artifacts of [[], [{ id: "os", type: "deb" }], [{ id: "app", type: "npm" }]]) {
    assert.throws(() => summarize([], { ...sbom, artifacts }));
  }
});
test("relatórios parciais, ferramenta errada e componente desconhecido reprovam", () => {
  assert.throws(() => summarizeImageSecurity(sbom, report([]), {}, sarif));
  assert.throws(() => summarizeImageSecurity(sbom, report([]), cyclonedx, {}));
  assert.throws(() => summarizeImageSecurity(sbom, { ...report([]), descriptor: {} }, cyclonedx, sarif));
  assert.throws(() => summarizeImageSecurity(sbom, {}, cyclonedx, sarif));
  const unknown = finding("High", "fixed");
  unknown.artifact.id = "foreign";
  assert.throws(() => summarize([unknown]));
});
test("severidade desconhecida ou correção sem destino não aprovam", () => {
  assert.throws(() => summarize([finding("unexpected", "fixed")]));
  const invalid = finding("Critical", "fixed");
  invalid.vulnerability.fix.versions = [];
  assert.throws(() => summarize([invalid]));
});
