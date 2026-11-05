export const scannerReleases = {
  syft: { version: "1.56.0", linux: "1c2493cfcf52d3367d6cb25780d9190c111c2219c34c820574c43e8bae15c528", win32: "c4cd2846dc0128e29a947bc6f56e1e5ef01707275b0e58590fbe48105198661d" },
  grype: { version: "0.121.1", linux: "bc3ea3f9e6fd56ac781c08c6c5e614271b79f438200757f6932085c19b0a4657", win32: "37f7b1b9c7d93a74174c5619ee16b321fc135670509f234235fdf2dc5f2c0852" },
};

export function summarizeImageSecurity(sbom, report, cyclonedx, sarif) {
  if (sbom?.descriptor?.name !== "syft" || sbom.descriptor.version !== scannerReleases.syft.version
    || !Array.isArray(sbom.artifacts) || !sbom.artifacts.length || !sbom.artifacts.every(item => typeof item.id === "string" && item.id.length > 0)
    || !sbom.artifacts.some(item => item.type === "deb") || !sbom.artifacts.some(item => item.type === "npm")) {
    throw new Error("SBOM inválido ou incompleto: exige versões esperadas e componentes Debian e npm.");
  }
  if (cyclonedx?.bomFormat !== "CycloneDX" || !Array.isArray(cyclonedx.components) || !cyclonedx.components.length
    || sarif?.version !== "2.1.0" || !sarif.runs?.some(run => /grype/iu.test(run.tool?.driver?.name || ""))) {
    throw new Error("Relatórios CycloneDX/SARIF ausentes ou inválidos.");
  }
  if (report?.descriptor?.name !== "grype" || report.descriptor.version !== scannerReleases.grype.version
    || !Array.isArray(report.matches)) throw new Error("Relatório Grype ausente ou inválido.");
  const identities = new Set(sbom.artifacts.map(item => item.id));
  const findings = new Map();
  for (const match of report.matches) {
    const vulnerability = match.vulnerability;
    if (!identities.has(match.artifact?.id) || !vulnerability?.id
      || !["Unknown", "Negligible", "Low", "Medium", "High", "Critical"].includes(vulnerability.severity)) {
      throw new Error("Achado não corresponde ao inventário ou possui severidade inválida.");
    }
    const fixed = vulnerability.fix?.state === "fixed";
    if (fixed && !vulnerability.fix.versions?.length) throw new Error("Correção indicada sem versão de destino.");
    const key = `${match.artifact.id}:${vulnerability.id}`;
    const previous = findings.get(key);
    const ranks = ["Unknown", "Negligible", "Low", "Medium", "High", "Critical"];
    const severity = previous && ranks.indexOf(previous.severity) > ranks.indexOf(vulnerability.severity) ? previous.severity : vulnerability.severity;
    findings.set(key, { id: vulnerability.id, package: match.artifact.name, version: match.artifact.version,
      severity, fixed: fixed || Boolean(previous?.fixed), fixes: [...new Set([...(previous?.fixes || []), ...(vulnerability.fix?.versions || [])])] });
  }
  const all = [...findings.values()];
  const blockers = all.filter(item => item.fixed && ["High", "Critical"].includes(item.severity));
  return { components: sbom.artifacts.length, findings: all.length, high: all.filter(item => item.severity === "High").length,
    critical: all.filter(item => item.severity === "Critical").length, blockers };
}
