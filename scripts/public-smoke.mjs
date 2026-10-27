import fs from "node:fs";
import { checkPublicResponse, productionOrigin, publicRoutes } from "./public-smoke-policy.mjs";

const results = [];
for (const route of publicRoutes) {
  try {
    const response = await fetch(new URL(route, productionOrigin), { method: "GET", redirect: "error", signal: AbortSignal.timeout(15000) });
    checkPublicResponse(route, { status: response.status, body: await response.text() });
    results.push({ route, ok: true, status: response.status });
  } catch (error) {
    results.push({ route, ok: false, error: error instanceof Error ? error.message : "Falha na resposta pública." });
  }
}
fs.mkdirSync("reports/deploy", { recursive: true });
fs.writeFileSync("reports/deploy/results.json", JSON.stringify(results, null, 2));
const markdown = ["## Conferência pública após deploy", "", "| Rota | Resultado |", "| --- | --- |", ...results.map(result => `| ${result.route} | ${result.ok ? "OK" : "Falha"} |`), ""].join("\n");
fs.writeFileSync("reports/deploy/summary.md", markdown);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
process.stdout.write(markdown);
if (results.some(result => !result.ok)) process.exitCode = 1;
