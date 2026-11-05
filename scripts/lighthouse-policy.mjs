export const lighthouseVersions = { lhci: "0.16.0", lighthouse: "13.6.0" };
export const publicPerformancePages = ["/", "/manifesto"];
const metrics = { lcpMs: "largest-contentful-paint", cls: "cumulative-layout-shift", tbtMs: "total-blocking-time", bytes: "total-byte-weight" };
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// A whitelist projection: never serialize the original Lighthouse report.
export function aggregateLighthouse(reports, base, chromiumVersion) {
  const origin = new URL(base);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.pathname !== "/") throw new Error("Destino Lighthouse deve ser o servidor descartável local.");
  if (!/^\d+(?:\.\d+){1,3}$/u.test(chromiumVersion)) throw new Error("Versão Chromium inválida.");
  if (!Array.isArray(reports) || reports.length !== 6) throw new Error("Lighthouse exige três amostras por página pública.");
  const grouped = new Map(publicPerformancePages.map(page => [page, []]));
  for (const report of reports) {
    const requested = new URL(report.requestedUrl);
    const final = new URL(report.finalDisplayedUrl || report.finalUrl);
    if (report.runtimeError || report.lighthouseVersion !== lighthouseVersions.lighthouse
      || requested.origin !== origin.origin || final.origin !== origin.origin
      || requested.pathname !== final.pathname || requested.search || final.search
      || requested.hash || final.hash || !grouped.has(requested.pathname)
      || report.audits?.["http-status-code"]?.score !== 1) throw new Error("Relatório inválido, erro HTTP ou página diferente da esperada.");
    const sample = { performance: report.categories?.performance?.score };
    if (!Number.isFinite(sample.performance) || sample.performance < 0 || sample.performance > 1) throw new Error("Pontuação Lighthouse ausente ou inválida.");
    for (const [name, audit] of Object.entries(metrics)) {
      const value = report.audits?.[audit]?.numericValue;
      if (!Number.isFinite(value) || value < 0) throw new Error("Métrica Lighthouse ausente ou inválida.");
      sample[name] = value;
    }
    grouped.get(requested.pathname).push(sample);
  }
  const pages = [...grouped].map(([page, samples]) => {
    if (samples.length !== 3) throw new Error("Número incorreto de amostras por página.");
    return { path: page, median: Object.fromEntries(Object.keys(samples[0]).map(key => [key, median(samples.map(sample => sample[key]))])), samples };
  });
  return { versions: { ...lighthouseVersions, chromium: chromiumVersion }, mode: "mobile-simulated", runsPerPage: 3, pages };
}
