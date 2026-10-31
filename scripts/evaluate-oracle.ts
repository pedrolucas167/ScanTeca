import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { buildEvaluationContext, buildOracleSystemPrompt, checkEvaluationAnswer, readOracleCompletion,
  parseOracleJudgment, ORACLE_JUDGE_PROMPT } from "@/modules/oracle";
import { oracleEvaluationCases } from "@/tests/oracle-evaluation-fixtures";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }), finish_reason: z.string().nullish() })).min(1),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional(), cost: z.number().optional() }).optional(),
});

type CompletionResult = {
  answer: string;
  durationMs: number;
  usage: z.infer<typeof completionSchema>["usage"] | null;
  firstDeltaMs?: number | null;
};
interface CaseResult {
  id: string;
  question: string;
  rubric: string;
  profile: string | null;
  sources: ReturnType<typeof buildEvaluationContext>["sources"];
  context: string;
  systemPromptHash: string;
  status: "not_run" | "passed" | "failed" | "error";
  generation?: CompletionResult | null;
  judge?: CompletionResult | null;
  evaluation?: ReturnType<typeof checkEvaluationAnswer>;
  error?: string;
}

async function main() {
  const args = process.argv.slice(2);
  let live = false;
  let streamed = false;
  let caseId: string | undefined;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--live") live = true;
    else if (args[index] === "--stream") streamed = true;
    else if (args[index] === "--case" && args[index + 1] && !caseId) caseId = args[++index];
    else throw new Error("Argumento inválido.");
  }
  const selectedCases = caseId ? oracleEvaluationCases.filter(item => item.id === caseId) : oracleEvaluationCases;
  if (!selectedCases.length) throw new Error("Cenário desconhecido.");
  const model = process.env.ORACLE_CHAT_MODEL || "google/gemini-2.5-flash";
  const judgeModel = process.env.ORACLE_EVAL_JUDGE_MODEL || model;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (live && !apiKey) throw new Error("Configure OPENROUTER_API_KEY para a avaliação real.");
  const maxTokens = Math.min(1600, Math.max(200, Number(process.env.ORACLE_MAX_TOKENS) || 800));
  const timestamp = new Date().toISOString();
  const cases: CaseResult[] = [];

  async function complete(targetModel: string, messages: { role: "system" | "user"; content: string }[], temperature: number, stream = false): Promise<CompletionResult> {
    const started = performance.now();
    const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Scanteca Oracle Evaluation" },
      body: JSON.stringify({ model: targetModel, messages, temperature, max_tokens: maxTokens, stream }),
    }, 60_000);
    if (!response.ok) throw new Error(`Provedor respondeu HTTP ${response.status}`);
    if (stream) {
      if (!response.body) throw new Error("Resposta incompleta do provedor");
      let usage: CompletionResult["usage"] = null;
      let firstDeltaMs: number | null = null;
      const answer = await readOracleCompletion(response.body, {
        onDelta(text) { if (text && firstDeltaMs === null) firstDeltaMs = Math.round(performance.now() - started); },
        onUsage(value) {
          usage = { ...(value.inputTokens !== null ? { prompt_tokens: value.inputTokens } : {}),
            ...(value.outputTokens !== null ? { completion_tokens: value.outputTokens } : {}),
            ...(value.costUsd !== null ? { cost: value.costUsd } : {}) };
        },
      });
      return { answer, durationMs: Math.round(performance.now() - started), firstDeltaMs, usage };
    }
    const data = completionSchema.parse(await response.json());
    const choice = data.choices[0]!;
    if (choice.finish_reason !== "stop") throw new Error("Resposta incompleta do provedor");
    return { answer: choice.message.content, durationMs: Math.round(performance.now() - started), usage: data.usage ?? null };
  }

  for (const testCase of selectedCases) {
    const context = buildEvaluationContext(testCase);
    const systemPrompt = buildOracleSystemPrompt({ mode: testCase.mode, scope: testCase.scope, profile: testCase.profile });
    const metadata = { id: testCase.id, question: testCase.question, rubric: testCase.rubric, profile: testCase.profile ?? null,
      sources: context.sources, context: context.content, systemPromptHash: createHash("sha256").update(systemPrompt).digest("hex") };
    if (!live) {
      cases.push({ ...metadata, status: "not_run" });
      continue;
    }
    let generation: Awaited<ReturnType<typeof complete>> | null = null;
    let judge: Awaited<ReturnType<typeof complete>> | null = null;
    try {
      generation = await complete(model, [{ role: "system", content: systemPrompt },
        { role: "user", content: `Evidências recuperadas:\n${context.content}\n\nPergunta do usuário: ${testCase.question}` }], 0.3, streamed);
      judge = await complete(judgeModel, [{ role: "system", content: ORACLE_JUDGE_PROMPT },
        { role: "user", content: JSON.stringify({ question: testCase.question, evidence: context.content, profile: testCase.profile ?? null, answer: generation.answer, rubric: testCase.rubric }) }], 0);
      const evaluation = checkEvaluationAnswer(testCase, generation.answer, parseOracleJudgment(judge.answer));
      cases.push({ ...metadata, status: evaluation.passed ? "passed" : "failed", generation, judge, evaluation });
      process.stdout.write(`${testCase.id}: ${evaluation.passed ? "PASS" : "FAIL"}\n`);
    } catch (error) {
      // Provider bodies and environment values are never included in errors or reports.
      const reason = error instanceof z.ZodError || error instanceof SyntaxError ? "Formato de resposta inválido"
        : error instanceof Error && /^(Provedor respondeu HTTP \d+|Resposta incompleta do provedor)$/.test(error.message)
          ? error.message : "Falha de rede, timeout ou processamento";
      cases.push({ ...metadata, status: "error", generation, judge, error: reason });
      process.stdout.write(`${testCase.id}: ERROR (${reason})\n`);
    }
  }
  const usage = (part: "generation" | "judge") => {
    const values = cases.flatMap(item => item[part] === undefined ? [] : [item[part]]);
    return {
      promptTokens: values.reduce((sum, item) => sum + (item?.usage?.prompt_tokens ?? 0), 0),
      completionTokens: values.reduce((sum, item) => sum + (item?.usage?.completion_tokens ?? 0), 0),
      reportedCostUsd: values.reduce((sum, item) => sum + (item?.usage?.cost ?? 0), 0),
      missingUsage: values.filter(item => item?.usage == null).length,
      missingCost: values.filter(item => item?.usage?.cost == null).length,
    };
  };
  const summary = { total: cases.length, passed: cases.filter(item => item.status === "passed").length,
    failed: cases.filter(item => item.status === "failed").length, errors: cases.filter(item => item.status === "error").length,
    notRun: cases.filter(item => item.status === "not_run").length, generationUsage: usage("generation"), judgeUsage: usage("judge") };
  const directory = join(process.cwd(), "reports");
  await mkdir(directory, { recursive: true });
  const output = join(directory, `oracle-evaluation-${timestamp.replace(/[:.]/g, "-")}.json`);
  await writeFile(output, JSON.stringify({ version: 3, timestamp, live, streamedGeneration: streamed, model, judgeModel, maxTokens,
    fixtureHash: createHash("sha256").update(JSON.stringify(oracleEvaluationCases)).digest("hex"),
    judgePromptHash: createHash("sha256").update(ORACLE_JUDGE_PROMPT).digest("hex"),
    limitations: "Synthetic fixed contexts; no database retrieval, authenticated HTTP, application progress, deferred learning or human judgment validation. Provider generation streams only when streamedGeneration is true. Automated judge may share the generation model and can be wrong.",
    summary, cases }, null, 2));
  process.stdout.write(`${JSON.stringify(summary)}\nRelatório: ${output}\n`);
  if (live && (summary.failed || summary.errors)) process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write("Avaliação não concluída. Verifique os argumentos, a configuração do provedor e o acesso à pasta reports.\n");
  process.exitCode = 1;
});
