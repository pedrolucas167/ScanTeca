import { expect, it } from "vitest";
import {
  bookRelevance,
  hasStrongFieldMatch,
  matchesEdition,
  parseSearchIsbn,
  rankVolumes,
  splitTitleAndAuthor,
  uniqueVolumes,
  volumeIsbn,
  type SearchVolume,
} from "@/lib/book-search-rules";

it("mantém vírgulas do título e a pontuação das iniciais", () => {
  expect(splitTitleAndAuthor("Comer, Rezar, Amar, Elizabeth Gilbert")).toEqual({
    title: "Comer, Rezar, Amar",
    author: "Elizabeth Gilbert",
  });
  expect(splitTitleAndAuthor("Behind Closed Doors — B. A. Paris")).toEqual({
    title: "Behind Closed Doors",
    author: "B. A. Paris",
  });
  expect(splitTitleAndAuthor("O Estrangeiro — ...")).toBeNull();
});

it("usa a língua como desempate depois de comparar título e autor", () => {
  const query = "O Ultimo Livro, B. A. Paris";
  const relevance = bookRelevance(query, splitTitleAndAuthor(query));
  const weak = { id: "weak", volumeInfo: { title: "O Último Livro", authors: ["Outra Pessoa"], language: "pt" } };
  const english = { id: "en", volumeInfo: { title: "O Último Livro", authors: ["B.A. Paris"] } };
  const portuguese = { id: "pt", volumeInfo: { title: "O Último Livro!", authors: ["Paris, B. A."], language: "pt" } };

  expect(hasStrongFieldMatch([weak], relevance)).toBe(false);
  expect(hasStrongFieldMatch([english], relevance)).toBe(true);
  expect(rankVolumes([weak, english, portuguese], relevance)).toEqual([portuguese, english, weak]);
});

it("prioriza um título inteiro acima de uma divisão com dois campos parciais", () => {
  const query = "Comer, Rezar, e Amar";
  const relevance = bookRelevance(query, splitTitleAndAuthor(query));
  const weak = { id: "weak", volumeInfo: { title: "Comer, Rezar e Sonhar", authors: ["E. Amar Júnior"] } };
  const full = { id: "full", volumeInfo: { title: "Comer, Rezar e Amar", authors: ["Elizabeth Gilbert"] } };

  expect(hasStrongFieldMatch([weak, full], relevance)).toBe(false);
  expect(rankVolumes([weak, full], relevance)).toEqual([full, weak]);
});

it("confere o dígito verificador e reconhece a mesma edição em ISBN-10 e ISBN-13", () => {
  const parsed = parseSearchIsbn("ISBN-10: 0-547-92822-x");
  expect(parsed).toEqual({ isbn: "054792822X", exactIsbn: "9780547928227" });
  expect(parseSearchIsbn("978-0-547-92822-8")).toBeNull();
  expect(parseSearchIsbn("Livro 9780547928227")).toBeNull();

  const exact: SearchVolume = {
    id: "exact",
    volumeInfo: { industryIdentifiers: [
      { type: "ISBN_10", identifier: "054792822X" },
      { type: "ISBN_13", identifier: "9780547928227" },
    ] },
  };
  const other: SearchVolume = {
    id: "other",
    volumeInfo: { industryIdentifiers: [{ type: "ISBN_13", identifier: "9780261102217" }] },
  };
  const duplicate: SearchVolume = {
    id: "duplicate",
    volumeInfo: { industryIdentifiers: [{ type: "ISBN_10", identifier: "054792822X" }] },
  };
  expect(matchesEdition(exact, "9780547928227")).toBe(true);
  expect(matchesEdition(duplicate, "9780547928227")).toBe(true);
  expect(matchesEdition(other, "9780547928227")).toBe(false);
  expect(volumeIsbn(exact)).toBe("9780547928227");
  expect(uniqueVolumes([exact, duplicate, other, { id: "other", volumeInfo: {} }])).toEqual([exact, other]);
});
