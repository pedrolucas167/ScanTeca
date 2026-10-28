import assert from "node:assert/strict";
import test from "node:test";

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
