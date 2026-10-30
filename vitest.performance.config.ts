import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/recommendations.perf.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
