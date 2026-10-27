import { test } from "node:test";
import assert from "node:assert/strict";
import { redactTestLog } from "./redact-test-log.mjs";

test("remove tokens de URLs e chaves privadas sem ocultar o diagnóstico", () => {
  const line = "Falha https://example.test/client?__clerk_db_jwt=dvb_fake&token=private sk_test_fake eyJfake.payload.signature";
  const sanitized = redactTestLog(line);
  for (const value of ["dvb_fake", "private", "sk_test_fake", "eyJfake.payload.signature"]) assert.equal(sanitized.includes(value), false);
  assert.ok(sanitized.includes("Falha https://example.test/client?"));
  assert.equal(redactTestLog("11 testes aprovados"), "11 testes aprovados");
});
