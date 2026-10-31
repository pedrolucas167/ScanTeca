import { describe, expect, it } from "vitest";
import { formatOracleContext } from "./context-format";

const input = (): Parameters<typeof formatOracleContext>[0] => ({
  readingNow: [], weekLogs: [], diaryEntries: [], similarBooks: [], semanticDiary: [], semanticReviews: [],
  semanticExternal: [], contextBooks: [], externalBooks: [], retrievalQuery: "Ecologia",
});
describe("Oracle context formatting", () => {
  it("does not invent grounding when every source is empty", () => {
    const result = formatOracleContext(input());
    expect(result.hasGrounding).toBe(false);
    expect(result.sources).toEqual([]);
  });
  it("keeps the evidence registry aligned across internal and external sections", () => {
    const data = input();
    data.contextBooks = [{ id: "book", title: "Duna", author: "Herbert", status: "TO_READ", genre: "Ficção",
      synopsis: "Ecologia", publishedDate: "1965", rating: null }];
    data.semanticDiary = [{ id: "diary", type: "REFLECTION", content: "Minha anotação", page: 20, tags: [],
      bookTitle: "Duna", bookAuthor: "Herbert", distance: 0.2 }];
    data.semanticReviews = [{ id: "review", content: "Minha avaliação", rating: 4, bookTitle: "Duna", bookAuthor: "Herbert", distance: 0.2 }];
    data.semanticExternal = [{ id: "research", source: "Fixture", title: "Pesquisa", content: "Pesquisa registrada", type: "article", distance: 0.2 }];
    data.externalBooks = [{ title: "Outro livro", author: "Outro autor", description: "Catálogo externo", genre: null }];
    const result = formatOracleContext(data);
    expect(result.sources.map(source => source.id)).toEqual(["book", "diary", "review", "research", "ext-0"]);
    for (const [number, text] of [[1, '"Duna"'], [2, "- [REFLECTION]"], [3, '- "Duna"'], [4, "- [Fixture"], [5, '"Outro livro"']] as const) {
      expect(result.content).toContain(`[${number}] ${text}`);
    }
    expect(result.hasGrounding).toBe(true);
    expect(result.sources.at(-1)?.external).toBe(true);
  });
  it("deduplicates recent and semantic diary evidence without mutating inputs", () => {
    const data = input();
    data.retrievalQuery = "Minhas anotações do diário";
    data.semanticDiary = [{ id: "same", type: "REFLECTION", content: "Memória semântica", page: null, tags: [],
      bookTitle: "Duna", bookAuthor: "Herbert", distance: 0.2 }];
    data.diaryEntries = [{ id: "same", type: "REFLECTION", content: "Memória recente", page: null, book: { title: "Duna", author: "Herbert" } }];
    const before = JSON.stringify(data);
    const result = formatOracleContext(data);
    expect(result.sources.map(source => source.id)).toEqual(["same"]);
    expect(result.content).toContain("Memória semântica");
    expect(result.content).not.toContain("Memória recente");
    expect(JSON.stringify(data)).toBe(before);
  });
  it("does not turn a distant memory into evidence", () => {
    const data = input();
    data.semanticExternal = [{ id: "distant", source: "Fixture", title: "Distante", content: "Sem relação", type: "article", distance: 0.9 }];
    expect(formatOracleContext(data).hasGrounding).toBe(false);
    expect(formatOracleContext(data).sources).toEqual([]);
  });
  it("uses reading progress only when the question asks about progress", () => {
    const data = input();
    data.readingNow = [{ title: "Duna", author: "Herbert", currentPage: 20, pages: 200, startedAt: null }];
    expect(formatOracleContext(data).hasGrounding).toBe(false);
    data.retrievalQuery = "Qual o progresso da leitura atual?";
    const result = formatOracleContext(data);
    expect(result.hasGrounding).toBe(true);
    expect(result.content).toContain("pág. 20 de 200 (10%)");
  });
});
