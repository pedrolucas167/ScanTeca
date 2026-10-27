import assert from "node:assert/strict";
import test from "node:test";
import { developmentClerkKeys } from "./e2e-clerk-keys.mjs";

const local = { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture", CLERK_SECRET_KEY: "sk_test_fixture", DATABASE_URL: "nao-importar", OPENROUTER_API_KEY: "nao-importar" };
test("retorna somente as duas chaves e prioriza o ambiente da CI", () => {
  assert.deepEqual(developmentClerkKeys({ CLERK_SECRET_KEY: "sk_test_ci" }, local), { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: local.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY: "sk_test_ci" });
});
test("recusa produção, par ausente e valor vazio sem fallback silencioso", () => {
  for (const env of [{ CLERK_SECRET_KEY: "sk_live_fixture" }, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_fixture" }, { CLERK_SECRET_KEY: "" }]) assert.throws(() => developmentClerkKeys(env, local));
  assert.throws(() => developmentClerkKeys({}));
});
