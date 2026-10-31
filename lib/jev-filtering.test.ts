import { it, expect } from "vitest";
import { jevExtractFilters, filtersToWhereClause } from "./jev-filtering";

  const testCases = [
    {
      query: "Livros de ficção científica",
      expected: { genre: "Ficção Científica" },
      description: "Gênero simples",
    },
    {
      query: "Fantasia e aventura",
      expected: { genre: "Fantasia" },
      description: "Gênero composto (primeiro match)",
    },
    {
      query: "Livros por Frank Herbert",
      expected: { author: "Frank Herbert" },
      description: "Autor com 'por'",
    },
    {
      query: "Escrito por J.K. Rowling",
      expected: { author: "J.K. Rowling" },
      description: "Autor com 'escrito por'",
    },
    {
      query: "Livros de 1965",
      expected: { year: 1965 },
      description: "Ano específico",
    },
    {
      query: "Livros dos anos 80",
      expected: { year: { min: 1980, max: 1989 } },
      description: "Década (anos 80)",
    },
    {
      query: "Década de 1990",
      expected: { year: { min: 1990, max: 1999 } },
      description: "Década explícita",
    },
    {
      query: "Livros antigos",
      expected: { year: { max: 1950 } },
      description: "Livros antigos",
    },
    {
      query: "Livros modernos",
      expected: { year: { min: 2000 } },
      description: "Livros modernos",
    },
    {
      query: "Livros que já li",
      expected: { status: "READ" },
      description: "Status lido",
    },
    {
      query: "O que estou lendo agora",
      expected: { status: "READING" },
      description: "Status lendo",
    },
    {
      query: "Quero ler",
      expected: { status: "TO_READ" },
      description: "Status a ler",
    },
    {
      query: "Livros com 5 estrelas",
      expected: { rating_min: 5, rating_max: 5 },
      description: "Rating exato",
    },
    {
      query: "Livros com nota alta",
      expected: { rating_min: 5 },
      description: "Rating alto",
    },
    {
      query: "Livros com pelo menos 4 estrelas",
      expected: { rating_min: 4 },
      description: "Rating mínimo",
    },
    {
      query: '"Duna"',
      expected: { title_contains: "duna" },
      description: "Título entre aspas",
    },
    {
      query: "Coleção Clássicos",
      expected: { collection: "clássicos" },
      description: "Coleção específica",
    },
    {
      query: "Ficção científica dos anos 60 por Isaac Asimov",
      expected: { genre: "Ficção Científica", year: { min: 1960, max: 1969 }, author: "Isaac Asimov" },
      description: "Múltiplos filtros",
    },
  ];

it.each(testCases)("$description", async ({ query, expected }) => {
  expect(await jevExtractFilters(query)).toMatchObject(expected);
});
it("mantém o isolamento do usuário ao converter filtros", () => {
  expect(filtersToWhereClause({ genre: "Fantasia", rating_min: 4 }, "u1"))
    .toMatchObject({ userId: "u1", genre: { contains: "Fantasia", mode: "insensitive" }, rating: { gte: 4 } });
});
it("rating mínimo não impõe um máximo", async () => {
  const filters = await jevExtractFilters("Livros com pelo menos 4 estrelas");
  expect(filters.rating_max).toBeUndefined();
});

it("interpreta páginas e não lidos sem confundir com livros concluídos", async () => {
  expect(await jevExtractFilters("+500 páginas não lidas")).toMatchObject({ pages_min: 501, status: "TO_READ" });
  expect(await jevExtractFilters("Livros com até 200 páginas")).toMatchObject({ pages_max: 200 });
  expect(await jevExtractFilters("Livros com menos de 200 páginas")).toMatchObject({ pages_max: 199 });
});

it("aplica as duas extremidades de um intervalo de anos", () => {
  expect(filtersToWhereClause({ year: { min: 1980, max: 1989 } }, "owner")).toEqual({
    userId: "owner", AND: [
      { publishedDate: { gte: "1980" } },
      { publishedDate: { lte: "1989-12-31" } },
    ],
  });
});
