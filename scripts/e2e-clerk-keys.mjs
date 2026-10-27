import fs from "node:fs";
import dotenv from "dotenv";

/** @param {Record<string, string | undefined>} environment
 * @param {Record<string, string | undefined>} local */
export function developmentClerkKeys(environment, local = {}) {
  const publicKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? local.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = environment.CLERK_SECRET_KEY ?? local.CLERK_SECRET_KEY;
  if (!publicKey?.startsWith("pk_test_") || !secretKey?.startsWith("sk_test_")) throw new Error("E2E requer as duas chaves Clerk de desenvolvimento.");
  return { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: publicKey, CLERK_SECRET_KEY: secretKey };
}

export function loadDevelopmentClerkKeys() {
  const local = {};
  for (const file of [".env", ".env.local", ".env.development.local"]) {
    if (fs.existsSync(file)) Object.assign(local, dotenv.parse(fs.readFileSync(file)));
  }
  // Somente as duas chaves são retornadas; URLs e outros serviços não são importados.
  return developmentClerkKeys(process.env, local);
}
