import { test } from "node:test";
import assert from "node:assert/strict";
import { isConventionalTitle, workflowProblems } from "./github-policy.mjs";

test("títulos convencionais com escopo, breaking change e português", () => {
  for (const title of ["fix(ui): corrigir foco", "feat!: alterar contrato", "chore(ci): ampliar automações"]) assert.equal(isConventionalTitle(title), true);
  for (const title of ["Update files", "fix: ", "fix: linha\ninjetada", null]) assert.equal(isConventionalTitle(title), false);
});
test("conteúdo do título é somente dado, sem execução", () => {
  assert.equal(isConventionalTitle("fix: $(um-comando)"), true);
  assert.equal(isConventionalTitle("fix: `outro-comando`"), true);
});
test("rejeita action mutável, permissões amplas e job sem timeout", () => {
  const errors = workflowProblems({ permissions: "write-all", jobs: { check: { steps: [{ uses: "actions/checkout@v6" }] } } });
  assert.equal(errors.length, 3);
});
test("aceita action fixada e permissões mínimas", () => {
  assert.deepEqual(workflowProblems({ permissions: { contents: "read" }, jobs: { check: { "timeout-minutes": 10, steps: [{ uses: `actions/checkout@${"a".repeat(40)}` }] } } }), []);
});
