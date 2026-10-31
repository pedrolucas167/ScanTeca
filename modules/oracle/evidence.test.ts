import { describe, expect, it } from "vitest";
import { createEvidenceRegistry, validateCitations, validateInventoryClaims } from "./evidence";

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
  it.each([
    "Em seu acervo pessoal, não há um livro que trate especificamente de navegação por rios.",
    "No seu acervo, não temos um livro que se encaixe nessa descrição.",
    "Sua biblioteca não contém nenhuma obra sobre astronomia.",
    "O único livro de ficção científica que consta é Jardins da Maré [1].",
    "É o único livro de ficção científica na sua biblioteca [1].",
    "A única obra do seu acervo é Jardins da Maré [1].",
    "Em seu acervo pessoal, não possuímos um título que se encaixe diretamente na descrição de navegação por rios.",
  ])("rejects unsupported inventory-wide absence: %s", text => {
    expect(validateInventoryClaims(text).valid).toBe(false);
  });
  it.each([
    "Nas fontes recuperadas do seu acervo não há um livro sobre rios.",
    "Não tenho informações sobre livros de navegação no seu acervo.",
    "Não posso afirmar que no seu acervo não há um livro sobre rios.",
    "Este título do catálogo externo não está na sua estante.",
    "O único livro que consta nas fontes recuperadas é Jardins da Maré [1].",
    "Nesta seleção, a única obra da sua biblioteca é Jardins da Maré [1].",
    "Não posso afirmar que é o único livro na sua biblioteca.",
  ])("preserves scoped uncertainty and explicit external sources: %s", text => {
    expect(validateInventoryClaims(text).valid).toBe(true);
  });
});
