import { defineConfig, mergeConfig } from "vitest/config";
import path from "node:path";
import coverage from "./vitest.coverage";

export default mergeConfig(coverage, defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: { reportsDirectory: "coverage/integration" },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
}));
