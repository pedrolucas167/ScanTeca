export const metrics = ["lines", "statements", "functions", "branches"];

export function assertCollectorMajor(version, expected) {
  const major = typeof version === "string" ? Number(version.match(/^(\d+)\./u)?.[1]) : NaN;
  if (!Number.isInteger(expected) || major !== expected) throw new Error("A base de cobertura não corresponde à versão principal do coletor. Revise a migração e documente a comparação.");
}

export function findRegressions(summary, minimums) {
  return metrics.flatMap(metric => {
    const actual = summary[metric]?.pct;
    const minimum = minimums[metric];
    if (![actual, minimum].every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)) {
      throw new Error(`Cobertura ou limite inválido: ${metric}.`);
    }
    return actual < minimum ? [{ metric, actual, minimum }] : [];
  });
}
