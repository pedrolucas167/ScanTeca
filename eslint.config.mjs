import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "reports/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/modules/*/*", "**/modules/*/*", "!@/modules/reading/client"],
          message: "Importe módulos pela API pública: @/modules/<nome>.",
        }],
      }],
    },
  },
  {
    files: ["modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/modules/*/*", "**/modules/*/*", "!@/modules/reading/client"], message: "Use a API pública do módulo." },
          { group: ["@/app/**", "next/server", "next/navigation", "@clerk/nextjs/**"], message: "Módulos não dependem da camada HTTP/UI ou de autenticação." },
        ],
      }],
    },
  },
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["error", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      
      // React rules
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      
      // General code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
]);

export default eslintConfig;
