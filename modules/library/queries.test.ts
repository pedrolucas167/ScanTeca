import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ books: vi.fn(), settings: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  book: { findMany: mocks.books }, librarySetting: { upsert: mocks.settings },
} }));
import { getCatalog, getCatalogDetails } from "./queries";

beforeEach(() => { vi.resetAllMocks(); mocks.books.mockResolvedValue([]); mocks.settings.mockResolvedValue({ name: "Acervo" }); });

it("seleciona somente resumos na carga inicial, restritos ao proprietário", async () => {
  mocks.books.mockResolvedValue([{ id: "book", collection: { name: "Estante" } }]);
  expect((await getCatalog("owner")).books[0]?.collection).toBe("Estante");
  const query = mocks.books.mock.calls[0]![0];
  expect(query.where).toEqual({ userId: "owner" });
  expect(query.select).toMatchObject({ isbn: true, createdAt: true, customOrder: true, rating: true });
  for (const field of ["synopsis", "notes", "userId", "updatedAt", "embedding"]) expect(query.select).not.toHaveProperty(field);
  expect(query).not.toHaveProperty("include");
});

it("detalhes de edição filtram por livro e proprietário", async () => {
  mocks.books.mockResolvedValue([{ id: "book", synopsis: "Texto", notes: "Nota privada", collection: { name: "Estante" } }]);
  expect((await getCatalogDetails("owner", "book"))[0]).toMatchObject({ synopsis: "Texto", notes: "Nota privada", collection: "Estante" });
  expect(mocks.books).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner", id: "book" } }));
});

it("exportação completa nunca consulta o acervo de outras contas", async () => {
  await getCatalogDetails("owner");
  expect(mocks.books).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" } }));
});
