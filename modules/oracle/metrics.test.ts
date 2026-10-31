import { afterEach, describe, expect, it, vi } from "vitest";
import { createOracleMetrics, logOracleMetrics } from "./metrics";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("Oracle numeric diagnostics", () => {
  it("adds separate parts of generation without adding repeated cumulative token counts", async () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(5).mockReturnValueOnce(15)
      .mockReturnValueOnce(20).mockReturnValueOnce(45).mockReturnValueOnce(50);
    const metrics = createOracleMetrics();
    await metrics.measure("generation", async () => "headers");
    await metrics.measure("generation", async () => "body");
    metrics.recordUsage("generation", { inputTokens: 40, outputTokens: 10, costUsd: 0.01 });
    metrics.recordUsage("generation", { inputTokens: 40, outputTokens: 10, costUsd: null });
    expect(metrics.snapshot("completed")).toEqual({ pipelineMs: 50, outcome: "completed", stages: { generation: 35 },
      usage: { generation: { inputTokens: 40, outputTokens: 10, costUsd: 0.01 } } });
  });
  it("records failed stages without recording exception contents", async () => {
    const metrics = createOracleMetrics();
    await expect(metrics.measure("retrieval", () => { throw new Error("private query"); })).rejects.toThrow();
    const snapshot = metrics.snapshot("failed");
    expect(snapshot.stages).toHaveProperty("retrieval");
    expect(JSON.stringify(snapshot)).not.toContain("private");
  });
  it("logs only when explicitly enabled", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const snapshot = createOracleMetrics().snapshot("cancelled");
    vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "0");
    logOracleMetrics(snapshot);
    expect(info).not.toHaveBeenCalled();
    vi.stubEnv("PERFORMANCE_DIAGNOSTICS", "1");
    logOracleMetrics(snapshot);
    expect(info).toHaveBeenCalledExactlyOnceWith("oracle-performance", snapshot);
  });
});
