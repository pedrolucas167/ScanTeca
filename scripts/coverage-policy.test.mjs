import { test } from "node:test";
import assert from "node:assert/strict";
import { assertCollectorMajor, findRegressions, metrics } from "./coverage-policy.mjs";

const summary = value => Object.fromEntries(metrics.map(metric => [metric, { pct: value }]));
const minimums = value => Object.fromEntries(metrics.map(metric => [metric, value]));

test("exige revisão da base ao trocar a versão principal do coletor", () => {
  assert.doesNotThrow(() => assertCollectorMajor("5.0.5", 5));
  assert.doesNotThrow(() => assertCollectorMajor("5.1.0", 5));
  for (const version of ["3.2.7", "6.0.0", "Unknown", undefined]) assert.throws(() => assertCollectorMajor(version, 5), /não corresponde/u);
});

test("aceita a base atual e melhorias sem atualizar os limites", () => {
  assert.deepEqual(findRegressions(summary(17.54), minimums(17.54)), []);
  assert.deepEqual(findRegressions(summary(20), minimums(17.54)), []);
});

test("rejeita regressão em uma métrica mesmo com melhora nas outras", () => {
  const data = summary(90);
  data.lines.pct = 17.53;
  assert.deepEqual(findRegressions(data, minimums(17.54)), [{ metric: "lines", actual: 17.53, minimum: 17.54 }]);
});

test("não aceita ausência de dados, Unknown ou NaN como aprovação", () => {
  for (const value of [undefined, "Unknown", NaN]) {
    const data = summary(90);
    data.branches.pct = value;
    assert.throws(() => findRegressions(data, minimums(10)), /inválido/);
  }
  assert.throws(() => findRegressions(summary(90), {}), /inválido/);
});
