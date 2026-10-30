import { describe, expect, it } from "vitest";
import { buildEvaluationContext, checkEvaluationAnswer, parseOracleJudgment, type OracleEvaluationCase } from "./evaluation";

const testCase: OracleEvaluationCase = {
  id: "sample", mode: "EXPLORE", scope: "library", question: "Qual o tema?",
  evidence: [{ source: { id: "book", title: "Jardins da Maré", author: "Lia Monte" }, content: "Tema: cooperação ambiental" }],
  expectedMentions: ["Jardins da Maré"], requiredCitations: [1], rubric: "Explicar o tema registrado",
};
const judgment = { relevant: true, faithful: true, citationsSupported: true, issues: [] };
const answer = "Jardins da Maré aborda cooperação ambiental [1].";

describe("Oracle evaluation scoring", () => {
  it("requires both deterministic checks and a valid judgment", () => {
    expect(checkEvaluationAnswer(testCase, answer, judgment).passed).toBe(true);
    expect(checkEvaluationAnswer(testCase, answer, null).passed).toBe(false);
  });
  it("does not pass an invented reference even if the judge accepts it", () => {
    expect(checkEvaluationAnswer(testCase, answer.replace("[1]", "[2]"), judgment).passed).toBe(false);
  });
  it("rejects unsupported claims with numerically valid references", () => {
    const result = checkEvaluationAnswer(testCase, answer, { ...judgment, faithful: false, issues: ["Prêmio inventado"] });
    expect(result.validCitationNumbers).toBe(true);
    expect(result.passed).toBe(false);
  });
  it("rejects wrong attribution reported by the judge", () => {
    expect(checkEvaluationAnswer(testCase, answer, { ...judgment, citationsSupported: false }).passed).toBe(false);
  });
  it("rejects a primary recommendation that fails the requested topic", () => {
    expect(checkEvaluationAnswer(testCase, answer, { ...judgment, relevant: false }).passed).toBe(false);
  });
  it("does not allow a favorable judge to override an unsupported inventory-wide claim", () => {
    const result = checkEvaluationAnswer(testCase, `${answer} Em seu acervo pessoal, não há um livro sobre rios.`, judgment);
    expect(result.passed).toBe(false);
    expect(result.unsupportedInventoryClaims).toHaveLength(1);
  });
  it("does not silently coerce invalid judge data to a pass", () => {
    expect(() => parseOracleJudgment('{"relevant":"true","faithful":true}')).toThrow();
    expect(() => parseOracleJudgment("Falha no provedor")).toThrow();
    expect(parseOracleJudgment(`\`\`\`json\n${JSON.stringify(judgment)}\n\`\`\``)).toEqual(judgment);
  });
  it("checks empty context without inventing a source", () => {
    expect(buildEvaluationContext({ ...testCase, evidence: [] })).toEqual({ sources: [], content: "Nenhuma evidência encontrada no acervo." });
  });
});
