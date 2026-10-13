import { it, expect } from "vitest";
import { jevRouteQuery, shouldDirectChat, shouldExecuteTool } from "./jev-routing";

  const testCases = [
    {
      query: "Oi, tudo bem?",
      expected: "chat",
      description: "Saudação simples",
    },
    {
      query: "Olá! Como você está?",
      expected: "chat",
      description: "Saudação com pergunta",
    },
    {
      query: "Bom dia!",
      expected: "chat",
      description: "Saudação temporal",
    },
    {
      query: "Obrigado pela ajuda!",
      expected: "chat",
      description: "Agradecimento",
    },
    {
      query: "Quem é você?",
      expected: "chat",
      description: "Pergunta sobre identidade",
    },
    {
      query: "Como funciona o oráculo?",
      expected: "chat",
      description: "Pergunta sobre funcionamento",
    },
    {
      query: "Interessante!",
      expected: "chat",
      description: "Reação casual",
    },
    {
      query: "Criar uma rota de leitura",
      expected: "tool",
      description: "Ação de criar rota",
    },
    {
      query: "Montar uma rota com Duna",
      expected: "tool",
      description: "Ação de montar rota",
    },
    {
      query: "Adicionar livro à minha estante",
      expected: "tool",
      description: "Ação de adicionar livro",
    },
    {
      query: "Marcar como lido",
      expected: "tool",
      description: "Ação de atualizar status",
    },
    {
      query: "Quais livros de ficção científica eu tenho?",
      expected: "search",
      description: "Busca por gênero",
    },
    {
      query: "Me recomende algo para ler agora",
      expected: "search",
      description: "Recomendação",
    },
    {
      query: "O que você acha de Frank Herbert?",
      expected: "search",
      description: "Busca por autor",
    },
    {
      query: "Livros de 1965",
      expected: "search",
      description: "Busca por ano",
    },
    {
      query: "Livros com 5 estrelas",
      expected: "search",
      description: "Busca por rating",
    },
  ];

it.each(testCases)("$description", async ({ query, expected }) => {
  expect((await jevRouteQuery(query)).action).toBe(expected);
});
it("seleciona apenas o executor correspondente", async () => {
  expect(shouldDirectChat(await jevRouteQuery("Oi!"))).toBe(true);
  expect(shouldExecuteTool(await jevRouteQuery("Criar rota"))).toBe(true);
  const search = await jevRouteQuery("Livros de ficção");
  expect(shouldDirectChat(search)).toBe(false);
  expect(shouldExecuteTool(search)).toBe(false);
});
