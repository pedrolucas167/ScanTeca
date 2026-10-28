import { defineConfig } from "vitest/config";

// include mantém arquivos não importados na medição, sem a opção all removida no v4.

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "modules/**/*.{ts,tsx}",
        "middleware.ts",
        "instrumentation.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.integration.test.ts", "**/*.d.ts"],
      reporter: ["json", "json-summary", "html"],
      reportsDirectory: "coverage/unit",
    },
  },
});
