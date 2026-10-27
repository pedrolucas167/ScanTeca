import fs from "node:fs";
import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

// Carrega somente as chaves Clerk. Nunca importa DATABASE_URL ou integrações de .env.
const local: Record<string, string> = {};
for (const file of [".env", ".env.local", ".env.development.local"]) {
  if (fs.existsSync(file)) Object.assign(local, dotenv.parse(fs.readFileSync(file)));
}
for (const key of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
  if (process.env[key] === undefined && local[key]) process.env[key] = local[key];
}
const publicKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.CLERK_SECRET_KEY;
if (!publicKey?.startsWith("pk_test_") || !secretKey?.startsWith("sk_test_")) throw new Error("E2E requer chaves Clerk de desenvolvimento.");
process.env.CLERK_PUBLISHABLE_KEY = publicKey;
const database = process.env.SCANTECA_TEST_DATABASE_URL;
if (!database) throw new Error("Defina SCANTECA_TEST_DATABASE_URL para o PostgreSQL descartável.");
const url = new URL(database);
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("E2E permite somente o banco descartável documentado.");
const isolatedEnvironment = {
  DATABASE_URL: database,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", OPENROUTER_API_KEY: "",
  UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "", KV_URL: "",
};
Object.assign(process.env, isolatedEnvironment);
const authenticated = process.env.E2E_AUTHENTICATED === "1";
if (authenticated && !process.env.E2E_CLERK_USER_EMAIL) throw new Error("Defina a conta Clerk exclusiva em E2E_CLERK_USER_EMAIL.");

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3020",
    colorScheme: "light",
    // Tokens Clerk não devem aparecer em traces ou vídeos publicados.
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    ...(authenticated ? [{ name: "clerk-setup", testMatch: "global.setup.ts" }] : []),
    { name: "guest-desktop", testMatch: "guest.spec.ts", use: { viewport: { width: 1440, height: 900 } } },
    { name: "guest-mobile", testMatch: "guest.spec.ts", use: { viewport: { width: 375, height: 900 } } },
    ...(authenticated ? [{ name: "authenticated", testMatch: "authenticated.spec.ts", dependencies: ["clerk-setup"], use: { screenshot: "off" as const } }] : []),
  ],
  webServer: {
    command: process.env.CI ? "npm run start -- --port 3020" : "npm run dev -- --port 3020",
    url: "http://localhost:3020",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      ...isolatedEnvironment,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey,
      CLERK_SECRET_KEY: secretKey,
    },
  },
});
