import { defineConfig, mergeConfig } from "vitest/config";
import path from "node:path";
import coverage from "./vitest.coverage.mjs";

export default mergeConfig(coverage, defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
}));
