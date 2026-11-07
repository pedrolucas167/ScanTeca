// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BookSearch from "./BookSearch";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<typeof fetch>();
const book = {
  googleId: "volume",
  title: "Good Omens",
  subtitle: null,
  author: "Neil Gaiman; Terry Pratchett",
  publishedDate: "1990",
  synopsis: null,
  pages: 288,
  genre: "Fantasia",
  isbn: "9780060853983",
  coverUrl: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  sessionStorage.removeItem("scanteca:book-search-timing");
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function changeQuery(value: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value } });
}

function advance(ms: number) {
  return act(() => vi.advanceTimersByTimeAsync(ms));
}

async function showResult() {
  fetchMock.mockResolvedValueOnce(Response.json({ results: [book] }));
  render(<BookSearch />);
  changeQuery(book.title);
  await advance(500);
}

it("reinicia o debounce e consulta imediatamente no submit sem repetir a requisição", async () => {
  fetchMock.mockResolvedValueOnce(Response.json({ results: [book] }));
  fetchMock.mockResolvedValueOnce(Response.json({ results: [] }));
  render(<BookSearch />);

  changeQuery("Good");
  await advance(300);
  changeQuery("  Good Omens  ");
  await advance(499);
  expect(fetchMock).not.toHaveBeenCalled();
  await advance(1);
  expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/search-books", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({ query: "Good Omens" }),
  }));
  expect(screen.getByRole("heading", { name: "Good Omens" })).toBeTruthy();

  changeQuery("Outro livro");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Buscar" })); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Nenhum livro encontrado. Tente outro termo.")).toBeTruthy();
  await advance(500);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("cancela a requisição anterior e ignora seu erro tardio", async () => {
  const old = Promise.withResolvers<Response>();
  fetchMock.mockReturnValueOnce(old.promise);
  fetchMock.mockResolvedValueOnce(Response.json({ results: [book] }));
  render(<BookSearch />);

  changeQuery("Anterior");
  await advance(500);
  const signal = fetchMock.mock.calls[0]?.[1]?.signal;
  expect(signal?.aborted).toBe(false);
  changeQuery(book.title);
  await advance(500);
  expect(signal?.aborted).toBe(true);
  await act(async () => { old.reject(new Error("resposta tardia")); });
  expect(screen.getByRole("heading", { name: "Good Omens" })).toBeTruthy();
  expect(screen.queryByText("Erro de rede ao buscar")).toBeNull();
});

it("limpa a busca e ignora o resultado que chega depois de limpar o campo", async () => {
  const pending = Promise.withResolvers<Response>();
  fetchMock.mockReturnValueOnce(pending.promise);
  render(<BookSearch />);

  changeQuery(book.title);
  await advance(500);
  changeQuery(" ");
  expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect((screen.getByRole("button", { name: "Buscar" }) as HTMLButtonElement).disabled).toBe(false);
  await act(async () => { pending.resolve(Response.json({ results: [book] })); });
  expect(screen.queryByRole("heading", { name: "Good Omens" })).toBeNull();
});

it("cancela a consulta ativa e o debounce ao desmontar a aba", async () => {
  fetchMock.mockReturnValueOnce(Promise.withResolvers<Response>().promise);
  const { unmount } = render(<BookSearch />);
  changeQuery(book.title);
  await advance(500);
  changeQuery("Outra consulta");
  unmount();
  expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  await advance(500);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("abre e cancela a prévia e salva somente ao confirmar com o estado selecionado", async () => {
  await showResult();
  fireEvent.click(screen.getByRole("button", { name: /Adicionar$/ }));
  expect(screen.getByRole("heading", { name: book.title, level: 1 })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Cancelar$/ }));
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const pending = Promise.withResolvers<Response>();
  fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole("button", { name: /Adicionar$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Lendo" }));
  fireEvent.click(screen.getByRole("button", { name: /Adicionar ao catálogo$/ }));
  expect(screen.getByRole("button", { name: /Salvando/ })).toBeTruthy();
  expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/books", expect.objectContaining({
    method: "POST",
    body: JSON.stringify({
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      publishedDate: book.publishedDate,
      synopsis: book.synopsis,
      coverUrl: book.coverUrl,
      genre: book.genre,
      pages: book.pages,
      status: "READING",
      collection: "Minha Biblioteca",
    }),
  }));
  await act(async () => { pending.resolve(Response.json({ book: { id: "new-book" } }, { status: 201 })); });
  expect(screen.queryByRole("heading", { name: book.title, level: 1 })).toBeNull();
  expect((screen.getByRole("button", { name: /Adicionado$/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('"Good Omens" adicionado ao catálogo!')).toBeTruthy();
  await advance(3000);
  expect(screen.queryByText('"Good Omens" adicionado ao catálogo!')).toBeNull();
});

it("abre a ficha existente quando a API informa um cadastro duplicado", async () => {
  await showResult();
  fetchMock.mockResolvedValueOnce(Response.json({ message: "Livro já cadastrado", book: { id: "existing" } }));
  fireEvent.click(screen.getByRole("button", { name: /Adicionar$/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Adicionar ao catálogo$/ }));
  });
  expect(push).toHaveBeenCalledWith("/books/existing");
  expect(screen.queryByRole("heading", { name: book.title, level: 1 })).toBeNull();
});

it("não registra tempos de busca ou capa sem ativação na sessão", async () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  fetchMock.mockResolvedValueOnce(Response.json({ results: [{
    ...book,
    coverUrl: "https://books.google.com/books/content?id=cover",
  }] }));
  render(<BookSearch />);
  changeQuery(book.title);
  await advance(500);
  fireEvent.load(screen.getByRole("img", { name: `Capa de ${book.title}` }));
  expect(log).not.toHaveBeenCalled();
});

it("registra tempos separados e apenas dados diagnósticos para a consulta e as capas", async () => {
  sessionStorage.setItem("scanteca:book-search-timing", "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const pending = Promise.withResolvers<Response>();
  fetchMock.mockReturnValueOnce(pending.promise);
  render(<BookSearch />);
  changeQuery("consulta privada");
  await advance(500);
  await advance(120);
  await act(async () => {
    pending.resolve(Response.json({ results: [
      { ...book, coverUrl: "https://books.google.com/books/content?id=cover" },
      { ...book, googleId: "other", title: "Outro livro", coverUrl: "https://books.google.com/books/content?id=other" },
    ] }));
  });
  const cover = screen.getByRole("img", { name: `Capa de ${book.title}` });
  await advance(250);
  fireEvent.load(cover);
  fireEvent.load(cover);
  await advance(100);
  fireEvent.error(screen.getByRole("img", { name: "Capa de Outro livro" }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(log.mock.calls).toEqual([
    ["[ScanTeca book search]", { stage: "results", outcome: "ok", status: 200, durationMs: 120 }],
    ["[ScanTeca book search]", { stage: "thumbnail", outcome: "load", durationMs: 250 }],
    ["[ScanTeca book search]", { stage: "thumbnail", outcome: "error", durationMs: 350 }],
  ]);
});

it("registra o status HTTP da busca sem registrar o corpo do erro", async () => {
  sessionStorage.setItem("scanteca:book-search-timing", "1");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  fetchMock.mockResolvedValueOnce(Response.json({ error: "Tente mais tarde" }, { status: 429 }));
  render(<BookSearch />);
  changeQuery(book.title);
  await advance(500);

  expect(screen.getByText("Tente mais tarde")).toBeTruthy();
  expect(log.mock.calls).toEqual([
    ["[ScanTeca book search]", { stage: "results", outcome: "http-error", status: 429, durationMs: 0 }],
  ]);
});
