import { it, expect } from "vitest";
import { jevRerank, mergeAndRerank, BookCandidate } from "./jev-reranking";

  const testCases = [
    {
      query: "Livros de ficção científica",
      candidates: [
        {
          id: "1",
          title: "Duna",
          author: "Frank Herbert",
          synopsis: "Uma épica ficção científica no planeta Arrakis",
          genre: "Ficção Científica",
          status: "READ",
          rating: 5,
          distance: 0.2,
        },
        {
          id: "2",
          title: "O Senhor dos Anéis",
          author: "J.R.R. Tolkien",
          synopsis: "Uma jornada épica na Terra Média",
          genre: "Fantasia",
          status: "READ",
          rating: 5,
          distance: 0.7,
        },
        {
          id: "3",
          title: "Fundação",
          author: "Isaac Asimov",
          synopsis: "O futuro da humanidade no espaço",
          genre: "Ficção Científica",
          status: "TO_READ",
          rating: 4,
          distance: 0.3,
        },
      ],
      mode: "EXPLORE",
      expectedTopId: "1",
      description: "Genre match with high rating",
    },
    {
      query: "O que estou lendo agora",
      candidates: [
        {
          id: "1",
          title: "Duna",
          author: "Frank Herbert",
          status: "READING",
          rating: 5,
          distance: 0.4,
        },
        {
          id: "2",
          title: "Fundação",
          author: "Isaac Asimov",
          status: "TO_READ",
          rating: 4,
          distance: 0.2,
        },
      ],
      mode: "JOURNEY",
      expectedTopId: "1",
      description: "JOURNEY mode boosts READING status",
    },
    {
      query: "Me recomende algo para ler",
      candidates: [
        {
          id: "1",
          title: "Duna",
          author: "Frank Herbert",
          status: "READ",
          rating: 5,
          distance: 0.3,
        },
        {
          id: "2",
          title: "Fundação",
          author: "Isaac Asimov",
          status: "TO_READ",
          rating: 4,
          distance: 0.4,
        },
      ],
      mode: "RECOMMEND",
      expectedTopId: "1",
      description: "RECOMMEND mode boosts high-rated READ books",
    },
    {
      query: "Frank Herbert",
      candidates: [
        {
          id: "1",
          title: "Duna",
          author: "Frank Herbert",
          status: "READ",
          rating: 5,
          distance: 0.5,
        },
        {
          id: "2",
          title: "Fundação",
          author: "Isaac Asimov",
          status: "READ",
          rating: 5,
          distance: 0.1,
        },
      ],
      mode: "EXPLORE",
      expectedTopId: "1",
      description: "Author match overrides semantic distance",
    },
  ];

it.each(testCases)("$description", async ({ query, candidates, mode, expectedTopId }) => {
  const results = await jevRerank(query, candidates, { mode: mode as "EXPLORE" | "JOURNEY" | "RECOMMEND", threshold: 40 });
  expect(results[0]?.id).toBe(expectedTopId);
});
it("mescla sem duplicar e descarta resultados abaixo do limiar", async () => {
  const semanticResults: BookCandidate[] = [
    {
      id: "1",
      title: "Duna",
      author: "Frank Herbert",
      publishedDate: "1965",
      genre: "Ficção Científica",
      distance: 0.2,
    },
    {
      id: "2",
      title: "Fundação",
      author: "Isaac Asimov",
      publishedDate: "1951",
      genre: "Ficção Científica",
      distance: 0.3,
    },
  ];

  const metadataResults: BookCandidate[] = [
    {
      id: "2",
      title: "Fundação",
      author: "Isaac Asimov",
      publishedDate: "1951",
      genre: "Ficção Científica",
    },
    {
      id: "3",
      title: "Neuromante",
      author: "William Gibson",
      publishedDate: "1984",
      genre: "Ficção Científica",
    },
  ];


  const results = await mergeAndRerank("Ficção científica", semanticResults, metadataResults, { mode: "EXPLORE" });
  expect(results.map(r => r.id)).toEqual(["1", "2"]);
  expect(new Set(results.map(r => r.id)).size).toBe(results.length);
  expect(results.every(r => r.relevance >= 40)).toBe(true);
});
