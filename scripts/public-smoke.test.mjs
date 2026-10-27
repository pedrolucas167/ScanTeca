import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPublicResponse, productionOrigin } from "./public-smoke-policy.mjs";

test("destino e rotas são fixos; APIs privadas não entram no smoke", () => {
  assert.equal(productionOrigin, "https://scanteca.vercel.app");
  assert.throws(() => checkPublicResponse("/api/notifications", { status: 200, body: "" }), /permitida/);
});
test("não aceita erro HTTP nem HTML de outra aplicação", () => {
  assert.throws(() => checkPublicResponse("/", { status: 503, body: "" }), /503/);
  assert.throws(() => checkPublicResponse("/", { status: 200, body: "<html>outra aplicação</html>" }), /inesperado/);
  assert.doesNotThrow(() => checkPublicResponse("/feed", { status: 200, body: "<html><title>Scanteca</title></html>" }));
});
test("confere o manifesto e o ícone sem depender de serviços autenticados", () => {
  assert.doesNotThrow(() => checkPublicResponse("/manifest.json", { status: 200, body: JSON.stringify({ name: "Scanteca", start_url: "/", display: "standalone" }) }));
  assert.throws(() => checkPublicResponse("/manifest.json", { status: 200, body: "{}" }), /inesperado/);
  assert.doesNotThrow(() => checkPublicResponse("/favicon.svg", { status: 200, body: "<svg></svg>" }));
});
