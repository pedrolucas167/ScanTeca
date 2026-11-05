import assert from "node:assert/strict";
import test from "node:test";
import { createOracleProviderFixture, oracleFixtureKey } from "./e2e-oracle-provider.mjs";

test("Oracle fixtures refuse production destinations and real provider keys", () => {
  const local = { E2E_ORACLE_FIXTURES: "1", DATABASE_URL: "postgresql://localhost:55439/scanteca_reading_test", OPENROUTER_API_KEY: oracleFixtureKey };
  assert.equal(createOracleProviderFixture({}), null);
  assert.throws(() => createOracleProviderFixture(local));
  assert.throws(() => createOracleProviderFixture({ ...local, DATABASE_URL: "postgresql://production.example/scanteca" }));
  assert.throws(() => createOracleProviderFixture({ ...local, DATABASE_URL: "postgresql://127.0.0.1:55439/scanteca_reading_test", OPENROUTER_API_KEY: "real-provider-key" }));
});

test("Oracle fixture failures recover and delayed responses honor cancellation", async () => {
  const fixture = createOracleProviderFixture({ E2E_ORACLE_FIXTURES: "1", DATABASE_URL: "postgresql://127.0.0.1:55439/scanteca_reading_test", OPENROUTER_API_KEY: oracleFixtureKey });
  const url = new URL("https://openrouter.ai/api/v1/chat/completions");
  const init = { body: JSON.stringify({ stream: true, messages: [{ content: "Pergunta do usuário: [falha-dupla]" }] }) };
  assert.equal((await fixture(url, init)).status, 503);
  assert.equal((await fixture(url, init)).status, 503);
  assert.match(await (await fixture(url, init)).text(), /Resposta de teste 3/);
  const controller = new AbortController();
  const delayed = await fixture(url, { signal: controller.signal, body: JSON.stringify({ stream: true, messages: [{ content: "[cancelar]" }] }) });
  controller.abort();
  await assert.rejects(() => delayed.text(), { name: "AbortError" });
  const regeneration = { body: JSON.stringify({ stream: true, messages: [{ content: "[cancelar-regeneracao]" }] }) };
  assert.match(await (await fixture(url, regeneration)).text(), /Resposta de teste 1/);
  const regenerating = new AbortController();
  const replacement = await fixture(url, { ...regeneration, signal: regenerating.signal });
  regenerating.abort();
  await assert.rejects(() => replacement.text(), { name: "AbortError" });
  assert.equal((await fixture(new URL("https://openrouter.ai/api/v1/audio/speech"))).status, 503);
});

test("simula apenas metadados externos e mantém Clerk e APIs locais reais", async () => {
  const original = globalThis.fetch;
  const forwarded = [];
  globalThis.fetch = async input => { forwarded.push(String(input)); return new Response("forwarded"); };
  try {
    await import("./e2e-provider-fixtures.mjs");
    assert.deepEqual((await (await fetch("https://openlibrary.org/search.json")).json()).docs, []);
    assert.deepEqual((await (await fetch("https://www.googleapis.com/books/v1/volumes")).json()).items, []);
    assert.equal(await (await fetch("https://api.clerk.com/v1/users")).text(), "forwarded");
    assert.equal(await (await fetch("http://localhost:3020/api/books")).text(), "forwarded");
    assert.equal(forwarded.length, 2);
  } finally { globalThis.fetch = original; }
});
