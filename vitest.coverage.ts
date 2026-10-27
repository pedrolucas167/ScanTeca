import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      all: true,
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "modules/**/*.{ts,tsx}",
        "middleware.ts",
        "instrumentation.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.integration.test.ts", "**/*.d.ts"],
      reporter: ["json", "json-summary", "html"],
      reportsDirectory: "coverage/unit",
    },
  },
});
