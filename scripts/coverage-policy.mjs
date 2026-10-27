export const metrics = ["lines", "statements", "functions", "branches"];

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
