import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { chromium } from "@playwright/test";
import { checkPublicPage, LighthousePreflightError } from "./lighthouse-preflight.mjs";

test("preflight waits for the public heading, rejects errors and never exposes page data", async t => {
  let mode = "delayed";
  const server = createServer((request, response) => {
    if (mode === "http") { response.writeHead(503); response.end("private-fixture"); return; }
    if (mode === "redirect" && request.url === "/") { response.writeHead(302, { Location: "/login?token=private-fixture" }); response.end(); return; }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(mode === "delayed"
      ? '<h1></h1><script>setTimeout(() => document.querySelector("h1").textContent = "Sua estante de livros físicos", 250)</script>'
      : '<h1>private-fixture</h1>');
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const base = `http://127.0.0.1:${server.address().port}`;
  // Reproduce the old one-shot check before checking the corrected behavior.
  await page.goto(base, { waitUntil: "domcontentloaded" });
  assert.equal((await page.locator("h1").textContent()).includes("Sua estante"), false);
  assert.deepEqual(await checkPublicPage(page, base, "/"), { route: "/", status: 200, headingVerified: true });
  for (const [scenario, reason] of [["http", "http-status"], ["redirect", "unexpected-destination"], ["wrong-heading", "heading-not-ready-or-invalid"]]) {
    mode = scenario;
    await assert.rejects(checkPublicPage(page, base, "/", 300), error => {
      assert.ok(error instanceof LighthousePreflightError);
      assert.equal(error.diagnostic.reason, reason);
      assert.equal(error.diagnostic.route, "/");
      assert.equal(JSON.stringify(error.diagnostic).includes("private-fixture"), false);
      return true;
    });
  }
});
