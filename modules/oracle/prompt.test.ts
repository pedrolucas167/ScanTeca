import { describe, expect, it } from "vitest";
import { buildOracleSystemPrompt } from "./prompt";
import { ORACLE_MODES } from "@/lib/constants/oracle";

describe("Oracle system prompt shared by production and evaluation", () => {
  it.each(ORACLE_MODES)("keeps grounding rules in $id", ({ id }) => {
    const prompt = buildOracleSystemPrompt({ mode: id, scope: "library" });
    expect(prompt).toContain(`Modo atual: ${id}`);
    expect(prompt).toContain("Cada afirmação factual deve ser sustentada por uma fonte do contexto");
    expect(prompt).not.toContain("Escopo ampliado");
  });
  it("includes the optional reader profile and broader scope", () => {
    expect(buildOracleSystemPrompt({ mode: "RECOMMEND", scope: "all", profile: "Gosta de poesia" }))
      .toContain("Gosta de poesia");
    expect(buildOracleSystemPrompt({ mode: "RECOMMEND", scope: "all" })).toContain("Escopo ampliado");
  });
});
