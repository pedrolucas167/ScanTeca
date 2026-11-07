import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { normalizeAuthor } from "@/lib/book-metadata";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), fetch: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: mocks.limit, rateLimits: {} }));
vi.mock("@/lib/fetch-with-retry", () => ({ fetchWithRetry: mocks.fetch }));

function request(query: string) {
  return new NextRequest("http://localhost/api/search-books", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

function volume(id: string, title: string, authors: string[], language = "en", isbn?: string) {
  return {
    id,
    volumeInfo: {
      title,
      authors,
      language,
      industryIdentifiers: isbn ? [{
        type: isbn.length === 13 ? "ISBN_13" : "ISBN_10",
        identifier: isbn,
      }] : undefined,
    },
  };
}

function reply(...items: ReturnType<typeof volume>[]) {
  mocks.fetch.mockResolvedValueOnce(Response.json({ items }));
}

function providerQueries() {
  return mocks.fetch.mock.calls.map(([url]) => {
    const params = new URL(url).searchParams;
    return [params.get("q"), params.get("langRestrict")];
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "reader" });
  mocks.limit.mockResolvedValue(null);
});

it.each([", ", " — ", "–", " - "])("busca título e autor separados por %s, mantendo as iniciais", async (separator) => {
  reply(volume("exact", "Behind Closed Doors", ["B.A. Paris"]));

  const response = await POST(request(`Behind Closed Doors${separator}B. A. Paris`));
  expect(response.status).toBe(200);
  expect(providerQueries()).toEqual([['intitle:"Behind Closed Doors" inauthor:"B. A. Paris"', null]]);
  expect(await response.json()).toMatchObject({
    results: [{ googleId: "exact", author: "B.A. Paris" }],
  });
});

it("mantém vírgulas internas quando o título vem seguido do autor", async () => {
  reply(volume("exact", "Comer, Rezar, Amar", ["Elizabeth Gilbert"], "pt"));

  await POST(request("Comer, Rezar, Amar, Elizabeth Gilbert"));
  expect(providerQueries()).toEqual([['intitle:"Comer, Rezar, Amar" inauthor:"Elizabeth Gilbert"', null]]);
});

it("recupera um título com vírgulas pela frase inteira quando a divisão produz resultados fracos", async () => {
  reply(volume("weak", "Comer, Rezar e Sonhar", ["E. Amar Júnior"], "pt"));
  reply(volume("exact", "Comer, Rezar e Amar", ["Elizabeth Gilbert"]));

  const response = await POST(request("Comer, Rezar, e Amar"));
  expect(providerQueries()).toEqual([
    ['intitle:"Comer, Rezar" inauthor:"e Amar"', null],
    ["Comer, Rezar, e Amar", null],
  ]);
  const { results } = await response.json();
  expect(results.map((book: { googleId: string }) => book.googleId)).toEqual(["exact", "weak"]);
});

it("ordena pela qualidade dos dois campos antes de usar o português como desempate", async () => {
  reply(
    volume("wrong-author", "O Último Livro", ["Outra Pessoa"], "pt"),
    volume("english", "O Último Livro", ["João Sá"]),
    volume("portuguese", "O Último Livro!", ["Sá, João"], "pt"),
    volume("partial", "O Último Livro Ilustrado", ["João Sá"], "pt")
  );

  const response = await POST(request("O Ultimo Livro, Joao Sa"));
  const { results } = await response.json();
  expect(results.map((book: { googleId: string }) => book.googleId)).toEqual([
    "portuguese", "english", "partial", "wrong-author",
  ]);
});

it("busca por autor isolado e mantém os dois nomes em ordem ao preparar o cadastro", async () => {
  reply(
    volume("unrelated", "Análise", ["Outro Nome"], "pt"),
    volume("exact", "Good Omens", ["Gaiman, Neil", "Terry Pratchett"])
  );

  const response = await POST(request("Neil Gaiman"));
  expect(providerQueries()).toEqual([["Neil Gaiman", null]]);
  const { results } = await response.json();
  expect(results[0]).toMatchObject({ googleId: "exact", author: "Neil Gaiman; Terry Pratchett" });
  expect(normalizeAuthor(results[0].author)).toBe(results[0].author);
});

it("recupera a busca por autor no formato sobrenome, nome", async () => {
  reply();
  reply(
    volume("unrelated", "Análise", ["Outro Nome"], "pt"),
    volume("exact", "Behind Closed Doors", ["B. A. Paris"])
  );

  const response = await POST(request("Paris, B. A."));
  expect(providerQueries()).toEqual([
    ['intitle:"Paris" inauthor:"B. A."', null],
    ["Paris, B. A.", null],
  ]);
  const { results } = await response.json();
  expect(results[0].googleId).toBe("exact");
});

it("ordena um título estrangeiro exato acima de um título português parcial", async () => {
  reply(
    volume("partial", "The Hobbit Companion", ["Outro Nome"], "pt"),
    volume("exact", "The Hobbit", ["J. R. R. Tolkien"])
  );

  const response = await POST(request("The Hobbit"));
  const { results } = await response.json();
  expect(results[0].googleId).toBe("exact");
});

it("busca a edição exata por ISBN em qualquer idioma e deduplica ISBN-10 e ISBN-13", async () => {
  reply(
    volume("other", "The Hobbit", ["J. R. R. Tolkien"], "pt", "9780261102217"),
    volume("exact", "The Hobbit", ["J. R. R. Tolkien"], "en", "9780547928227"),
    volume("duplicate", "The Hobbit", ["J. R. R. Tolkien"], "en", "054792822X")
  );

  const response = await POST(request("ISBN-10: 0-547-92822-x"));
  expect(providerQueries()).toEqual([["isbn:054792822X", null]]);
  const { results } = await response.json();
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({ googleId: "exact", isbn: "9780547928227" });
});

it("tenta os dígitos do ISBN como texto se o campo específico não encontrar a edição", async () => {
  reply(volume("other", "The Hobbit", ["J. R. R. Tolkien"], "pt", "9780261102217"));
  reply(volume("exact", "The Hobbit", ["J. R. R. Tolkien"], "en", "9780547928227"));

  const response = await POST(request("978-0-547-92822-7"));
  expect(providerQueries()).toEqual([["isbn:9780547928227", null], ["9780547928227", null]]);
  expect(await response.json()).toMatchObject({ results: [{ googleId: "exact" }] });
});

it("busca como texto um ISBN com dígito verificador inválido", async () => {
  reply();

  const response = await POST(request("9780547928228"));
  expect(providerQueries()).toEqual([["9780547928228", null]]);
  expect(await response.json()).toEqual({ results: [] });
});

it("mantém o erro 502 quando o Google Books falha", async () => {
  mocks.fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
  expect((await POST(request("The Hobbit"))).status).toBe(502);
});

it("aplica o rate limit antes de consultar o provedor", async () => {
  mocks.limit.mockResolvedValue(NextResponse.json({}, { status: 429 }));
  expect((await POST(request("The Hobbit"))).status).toBe(429);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
