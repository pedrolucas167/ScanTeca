// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { catalogBooks } from "../tests/catalog-fixtures";
import { toCatalogBook } from "../lib/catalog-book";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import Catalog from "./Catalog";

const books = catalogBooks(50);
function showCatalog() {
  return render(<Catalog books={books.map(toCatalogBook)} libraryName="Estante" shareEnabled={false} shareId={null} />);
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("limita a renderização inicial sem buscar detalhes e encontra livros fora da primeira página", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const { container } = showCatalog();
  expect(container.querySelectorAll('a[href^="/books/book-"]')).toHaveLength(24);
  expect(screen.getByText("Exibindo 24 de 50 livros")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText("Buscar por título, autor, ISBN ou gênero..."), { target: { value: "Livro 0049" } });
  expect(container.querySelectorAll('a[href^="/books/book-"]')).toHaveLength(1);
  expect(container.querySelector('a[href="/books/book-49"]')).toBeTruthy();
});

it("mostra mais livros e reinicia o limite ao mudar a pesquisa", async () => {
  const user = userEvent.setup();
  showCatalog();
  await user.click(screen.getByRole("button", { name: "Mostrar mais livros" }));
  expect(screen.getByText("Exibindo 48 de 50 livros")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Buscar por título, autor, ISBN ou gênero..."), { target: { value: "Livro" } });
  expect(screen.getByText("Exibindo 24 de 50 livros")).toBeTruthy();
});

it("busca textos completos ao editar e preserva notas ao salvar", async () => {
  const fullBook = books[0]!;
  const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => options?.method === "PATCH"
    ? Response.json({ book: fullBook }) : Response.json({ books: [fullBook] }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup(); showCatalog();
  await user.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
  expect(await screen.findByRole("heading", { name: "Editar Livro" })).toBeTruthy();
  expect(document.querySelector("textarea")?.value).toBe(fullBook.synopsis);
  await user.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(true));
  const save = fetchMock.mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(JSON.parse(save[1]!.body as string)).toMatchObject({ synopsis: fullBook.synopsis, notes: fullBook.notes });
});

it("não abre formulário incompleto quando a busca de detalhes falha", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Falha ao carregar" }, { status: 503 })));
  const user = userEvent.setup(); showCatalog();
  await user.click(screen.getAllByRole("button", { name: "Editar" })[0]!);
  expect(await screen.findByText("Falha ao carregar")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Editar Livro" })).toBeNull();
});

it.each(["", "Livro 0049"])("exporta resultados filtrados com notas, incluindo livros fora da primeira página (busca=%s)", async (query) => {
  const blobs: Blob[] = [];
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL(blob: Blob) { blobs.push(blob); return "blob:catalog"; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const fetchMock = vi.fn(async () => Response.json({ books })); vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup(); showCatalog();
  if (query) fireEvent.change(screen.getByPlaceholderText("Buscar por título, autor, ISBN ou gênero..."), { target: { value: query } });
  await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
  await user.click(screen.getByRole("button", { name: /CSV/ }));
  await waitFor(() => expect(blobs).toHaveLength(1));
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
    reader.readAsText(blobs[0]!);
  });
  expect(csv).toContain(books[49]!.title);
  expect(csv).toContain(books[49]!.notes!);
  expect(csv.split("\n")).toHaveLength(query ? 2 : 51);
  expect(fetchMock).toHaveBeenCalledWith("/api/books/details", { cache: "no-store" });
});
