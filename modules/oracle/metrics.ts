import type { OracleUsage } from "@/lib/oracle-usage";

export type OracleTiming = "context" | "rewrite" | "embedding" | "retrieval" | "external" | "generation" | "validation" | "persistence";
export type OracleUsageStage = "rewrite" | "embedding" | "generation";
export type OracleOutcome = "completed" | "rejected" | "failed" | "cancelled";

export function createOracleMetrics() {
  const started = performance.now();
  const stages: Partial<Record<OracleTiming, number>> = {};
  const usage: Partial<Record<OracleUsageStage, OracleUsage>> = {};
  return {
    async measure<T>(stage: OracleTiming, task: () => T | PromiseLike<T>): Promise<T> {
      const begin = performance.now();
      try { return await task(); }
      finally { stages[stage] = (stages[stage] ?? 0) + performance.now() - begin; }
    },
    recordUsage(stage: OracleUsageStage, value: OracleUsage) {
      const previous = usage[stage];
      usage[stage] = { inputTokens: value.inputTokens ?? previous?.inputTokens ?? null,
        outputTokens: value.outputTokens ?? previous?.outputTokens ?? null, costUsd: value.costUsd ?? previous?.costUsd ?? null };
    },
    snapshot(outcome: OracleOutcome) {
      return { pipelineMs: Math.round(performance.now() - started), outcome,
        stages: Object.fromEntries(Object.entries(stages).map(([stage, duration]) => [stage, Math.round(duration)])),
        usage: structuredClone(usage) };
    },
  };
}

export function logOracleMetrics(metrics: ReturnType<ReturnType<typeof createOracleMetrics>["snapshot"]>) {
  if (process.env.PERFORMANCE_DIAGNOSTICS !== "1") return;
  // eslint-disable-next-line no-console -- Opt-in numeric diagnostics; no content or account/session identifiers.
  console.info("oracle-performance", metrics);
}
