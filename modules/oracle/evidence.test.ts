import { describe, expect, it } from "vitest";
import { createEvidenceRegistry, validateCitations } from "./evidence";

describe("Oracle evidence references", () => {
  it("keeps numbers aligned across books, diary, reviews and external sources", () => {
    const registry = createEvidenceRegistry();
    const entries = [
      { id: "book", title: "Duna", author: "Herbert" },
      { id: "diary", title: "Duna", author: "Herbert", sourceType: "diary" as const },
      { id: "review", title: "Duna", author: "Herbert", sourceType: "review" as const },
      { id: "external", title: "Fundação", author: "Asimov", external: true },
    ];
    for (const [index, entry] of entries.entries()) {
      expect(registry.add(entry, entry.title)).toBe(`[${index + 1}] ${entry.title}`);
      expect(registry.sources[index]).toEqual(entry);
    }
  });
  it.each(["Resposta [0]", "Resposta [5]", "Resposta [99999999999999999999]"])("rejects nonexistent citation: %s", text => {
    expect(validateCitations(text, 4).valid).toBe(false);
  });
  it("deduplicates valid citations without treating years as citations", () => {
    expect(validateCitations("Publicado em 1965 [2], anotação [1], novamente [2].", 2)).toEqual({ valid: true, citations: [1, 2] });
  });
});
