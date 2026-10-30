import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ books: vi.fn(), settings: vi.fn(), createSettings: vi.fn(), winner: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  book: { findMany: mocks.books }, librarySetting: { findUnique: mocks.settings, create: mocks.createSettings, findUniqueOrThrow: mocks.winner },
} }));
import { getCatalog, getCatalogDetails, getLibrarySettings } from "./queries";
import { Prisma } from "@prisma/client";

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

it("lê configurações existentes sem iniciar criação ou transação", async () => {
  mocks.settings.mockResolvedValue({ name: "Nome escolhido", shareEnabled: true, accentTheme: "vinho" });
  expect(await getLibrarySettings("owner")).toMatchObject({ name: "Nome escolhido", shareEnabled: true, accentTheme: "vinho" });
  expect(mocks.settings).toHaveBeenCalledWith({ where: { userId: "owner" } });
  expect(mocks.createSettings).not.toHaveBeenCalled();
});

it("cria preferências apenas para uma biblioteca nova", async () => {
  mocks.settings.mockResolvedValue(null);
  mocks.createSettings.mockResolvedValue({ name: "Minha Biblioteca", userId: "new" });
  expect(await getLibrarySettings("new")).toMatchObject({ userId: "new" });
  expect(mocks.createSettings).toHaveBeenCalledWith({ data: { userId: "new", name: "Minha Biblioteca" } });
});

it("recupera as preferências vencedoras de uma primeira visita concorrente", async () => {
  mocks.settings.mockResolvedValue(null);
  mocks.createSettings.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
  mocks.winner.mockResolvedValue({ userId: "new", name: "Nome concorrente", shareEnabled: true });
  expect(await getLibrarySettings("new")).toMatchObject({ name: "Nome concorrente", shareEnabled: true });
  expect(mocks.winner).toHaveBeenCalledWith({ where: { userId: "new" } });
});

it("propaga falhas reais sem transformá-las em uma segunda leitura", async () => {
  mocks.settings.mockResolvedValue(null);
  mocks.createSettings.mockRejectedValue(new Error("connection lost"));
  await expect(getLibrarySettings("new")).rejects.toThrow("connection lost");
  expect(mocks.winner).not.toHaveBeenCalled();
});
