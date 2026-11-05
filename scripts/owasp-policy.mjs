export const owaspImage = "owasp/dependency-check:13.0.0@sha256:0e8f69ad5b00d62000937f4e57189812343f6903d9c83ee712012d51542a020a";
export const nvdDatafeed = "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-{0}.json.gz";

export function dependencyInstallArguments(input) {
  return ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--include=dev", "--prefix", input];
}

export function scannerArguments({ input, output, data, name, user = "1000:1000" }) {
  if (!/^scanteca-owasp-\d+$/u.test(name)) throw new Error("Nome de container de teste inválido.");
  if (!/^\d+:\d+$/u.test(user)) throw new Error("Identidade do runner inválida.");
  return ["run", "--rm", "--name", name, "--user", user,
    "--mount", `type=bind,source=${input},target=/input,readonly`,
    "--mount", `type=bind,source=${output},target=/output`,
    "--mount", `type=bind,source=${data},target=/data`,
    owaspImage, "--project", "ScanTeca", "--scan", "/input/package-lock.json",
    "--out", "/output", "--data", "/data",
    "--suppression", "/input/dependency-check-suppressions.xml",
    "--nvdDatafeed", nvdDatafeed, "--disableOssIndex",
    "--format", "HTML", "--format", "JSON", "--format", "SARIF", "--failOnCVSS", "11"];
}

export function reportSummary(report, sarif) {
  if (!report || !Array.isArray(report.dependencies) || report.dependencies.length === 0) throw new Error("Relatório OWASP vazio: nenhum componente analisado.");
  if (report.scanInfo?.engineVersion !== "13.0.0") throw new Error("Relatório não corresponde à versão fixada do scanner.");
  if (!sarif || sarif.version !== "2.1.0" || !Array.isArray(sarif.runs) || !sarif.runs.some(run => /dependency.?check/iu.test(run.tool?.driver?.name || ""))) throw new Error("Relatório SARIF ausente ou inválido.");
  const findings = new Map();
  for (const dependency of report.dependencies) {
    for (const vulnerability of dependency.vulnerabilities || []) {
      if (vulnerability.name) findings.set(vulnerability.name, vulnerability.severity || "UNKNOWN");
    }
  }
  return { components: report.dependencies.length, vulnerabilities: findings.size,
    critical: [...findings.values()].filter(severity => severity === "CRITICAL").length,
    high: [...findings.values()].filter(severity => severity === "HIGH").length };
}
