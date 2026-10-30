import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { book: { findMany: vi.fn().mockResolvedValue([]) } } }));
import { prisma } from "@/lib/prisma";
import { rankBooks, retrieveBooks, searchTerms, type OracleBook } from "./retrieval";

const dune: OracleBook = { id: "dune", title: "Duna", author: "Frank Herbert", synopsis: "Política e ecologia em um planeta desértico",
  publishedDate: "1965", genre: "Ficção Científica", status: "TO_READ", rating: null };
const foundation: OracleBook = { ...dune, id: "foundation", title: "Fundação", author: "Isaac Asimov", synopsis: "O futuro de um império galáctico" };
beforeEach(() => vi.mocked(prisma.book.findMany).mockReset().mockResolvedValue([]));

describe("Oracle retrieval reference questions", () => {
  it.each([
    ["Onde está Duna?", [dune], ["dune"]],
    ["Quais livros de Herbert eu tenho?", [foundation, dune], ["dune"]],
    ['Compare "Duna" e "Fundação"', [foundation, dune], ["dune", "foundation"]],
    ["Quero livros sobre ecologia", [foundation, dune], ["dune"]],
    ["Livros sobre culinária japonesa", [dune, foundation], []],
  ] as const)("%s", (query, candidates, expected) => {
    expect(rankBooks(query, [...candidates]).map(book => book.id)).toEqual(expected);
  });
  it("keeps a semantic match without lexical overlap", () => {
    expect(rankBooks("Viagens interplanetárias", [{ ...dune, distance: 0.25 }])[0]?.matchedBy).toContain("semântica");
  });
  it("does not mistake a zero vector distance for a missing match", () => {
    expect(rankBooks("Viagens", [{ ...dune, distance: 0 }])).toHaveLength(1);
  });
  it("uses title boundaries and deduplicates candidates", () => {
    expect(rankBooks("Dunamente", [dune, dune])).toEqual([]);
    expect(rankBooks("Duna", [dune, dune])).toHaveLength(1);
  });
  it("finds a title without embeddings and scopes the database query to its owner", async () => {
    vi.mocked(prisma.book.findMany).mockResolvedValueOnce([dune] as never);
    const result = await retrieveBooks("owner", "Onde está Duna?", []);
    expect(result.books[0]?.id).toBe("dune");
    expect(prisma.book.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner" }) }));
  });
  it("accepts structured matches without semantic similarity", async () => {
    vi.mocked(prisma.book.findMany).mockResolvedValueOnce([dune] as never);
    expect((await retrieveBooks("owner", "Livros de 1965", [])).books[0]?.matchedBy).toContain("filtros");
  });
  it("does not reintroduce semantic books excluded by a mandatory status", async () => {
    vi.mocked(prisma.book.findMany).mockResolvedValue([]);
    expect((await retrieveBooks("owner", "Livros não lidos", [{ ...dune, status: "READ", distance: 0.1 }])).books).toEqual([]);
    expect(prisma.book.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { AND: [{ userId: "owner", status: "TO_READ" }, { id: { in: ["dune"] } }] },
    }));
  });
  it("does not restrict a comparison to its first quoted title", async () => {
    vi.mocked(prisma.book.findMany).mockResolvedValueOnce([dune, foundation] as never);
    expect((await retrieveBooks("owner", 'Compare "Duna" e "Fundação"', [])).books).toHaveLength(2);
    expect(prisma.book.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }));
  });
  it("bounds lexical query size", () => expect(searchTerms("livros ".repeat(100))).toEqual([]));
  it("uses the selected mode only after finding evidence of relevance", () => {
    const candidates = [{ ...dune, distance: 0.2 }, { ...foundation, status: "READING", distance: 0.2 }];
    expect(rankBooks("Viagens", candidates, undefined, "JOURNEY")[0]?.id).toBe("foundation");
    expect(rankBooks("Culinária", [{ ...foundation, status: "READING" }], undefined, "JOURNEY")).toEqual([]);
  });
});
