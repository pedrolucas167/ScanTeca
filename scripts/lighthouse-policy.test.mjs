import assert from "node:assert/strict";
import test from "node:test";
import { aggregateLighthouse, lighthouseVersions } from "./lighthouse-policy.mjs";

const base = "http://127.0.0.1:12345";
function report(page, value) {
  return { requestedUrl: `${base}${page}`, finalDisplayedUrl: `${base}${page}`, lighthouseVersion: lighthouseVersions.lighthouse,
    categories: { performance: { score: 0.8 } }, audits: { "http-status-code": { score: 1 },
      "largest-contentful-paint": { numericValue: value }, "cumulative-layout-shift": { numericValue: 0.1 },
      "total-blocking-time": { numericValue: 100 }, "total-byte-weight": { numericValue: 123456 } } };
}
const fixtures = () => [report("/", 1000), report("/", 9000), report("/", 2000), report("/manifesto", 1100), report("/manifesto", 1200), report("/manifesto", 1300)];
const aggregate = data => aggregateLighthouse(data, base, "152.0.1.2");

test("mediana não confunde um outlier com regressão consistente", () => {
  assert.equal(aggregate(fixtures()).pages[0].median.lcpMs, 2000);
});
test("artifact whitelist não contém cookies, headers, screenshots ou URLs externas", () => {
  const data = fixtures();
  for (const item of data) Object.assign(item, { cookies: "private-fixture-cookie", headers: { Authorization: "private-fixture-token" }, screenshot: "private-fixture-image", network: [{ url: "https://external.invalid/?token=private-fixture-query" }] });
  const serialized = JSON.stringify(aggregate(data));
  for (const value of ["private-fixture", "cookies", "headers", "Authorization", "screenshot", "external.invalid", "127.0.0.1"]) assert.equal(serialized.includes(value), false);
});
test("token em URL, redirecionamento ou outra página reprovam", () => {
  for (const url of [`${base}/?token=private-fixture`, "https://external.invalid/", `${base}/sign-in`]) {
    const data = fixtures();
    data[0].finalDisplayedUrl = url;
    assert.throws(() => aggregate(data));
  }
});
test("relatório parcial, HTTP inválido, erro de runtime e versão diferente não aprovam", () => {
  assert.throws(() => aggregate(fixtures().slice(1)));
  for (const change of [item => { item.runtimeError = { code: "NO_FCP" }; }, item => { item.audits["http-status-code"].score = 0; }, item => { item.audits["largest-contentful-paint"].numericValue = NaN; }, item => { item.lighthouseVersion = "other"; }]) {
    const data = fixtures(); change(data[0]); assert.throws(() => aggregate(data));
  }
});
