import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ fields: vi.fn() }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina a base local isolada de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Base de integração não permitida.");
  return { prisma: new PrismaClient({ datasourceUrl: raw }) };
});
vi.mock("@/lib/book-cover", () => ({ findBookCover: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/synopsis", () => ({ findSynopsis: vi.fn().mockResolvedValue(null), cleanSynopsis: (value: string | null | undefined) => value?.trim() || null }));
vi.mock("@/lib/original-date", () => ({ findOriginalPublishYear: vi.fn().mockResolvedValue(null), extractYear: (value: string | null) => value ? Number(value.slice(0, 4)) : null }));
vi.mock("@/lib/embeddings", () => ({ generateEmbedding: vi.fn().mockResolvedValue(null), bookToEmbeddingText: () => "book" }));
vi.mock("@/lib/push", () => ({ notifyGoalIfReached: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/recommendations-cache", () => ({ invalidateRecommendationsCache: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./enrichment-provider", () => ({ fetchGoogleBooksFields: provider.fields }));
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn(async () => ({
  ok: true, json: async () => ({ "ISBN:9788535902778": {
    title: "Livro do scanner", authors: [{ name: "Autor" }], number_of_pages: 100,
    subjects: [{ name: "Fiction" }],
  } }),
})) }));
import { prisma } from "@/lib/prisma";
import { createBook } from "./service";
import { bookCreateSchema } from "./contracts";
import { scanBook, scanSchema } from "./scan";
import { reorderBooks, reorderSchema } from "./reorder";
import { updateLibrarySettings, settingsSchema } from "./settings";
import { getSharedCatalog, getBookDetail } from "./queries";
import { enrichBooks } from "./enrichment";
import { generateEmbedding } from "@/lib/embeddings";
import { refreshBookEmbedding } from "./indexing";

const owner = "library-integration-owner";
const input = (title = "Livro", isbn?: string) => bookCreateSchema.parse({ title, author: "Autor", isbn });
beforeEach(async () => {
  vi.mocked(generateEmbedding).mockReset().mockResolvedValue(null);
  provider.fields.mockReset();
  provider.fields.mockResolvedValue({ synopsis: "Sinopse do provedor", genre: "Ficção", pages: 120 });
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS library_test_fail_move ON "Book"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS library_test_fail_move()');
  await prisma.book.deleteMany({ where: { userId: { startsWith: "library-integration-" } } });
  await prisma.collection.deleteMany({ where: { userId: { startsWith: "library-integration-" } } });
  await prisma.librarySetting.deleteMany({ where: { userId: { startsWith: "library-integration-" } } });
});
afterAll(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS library_test_fail_move ON "Book"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS library_test_fail_move()');
  await prisma.$disconnect();
});

describe("Biblioteca com PostgreSQL", () => {
  it("cadastros concorrentes por ISBN criam um único livro", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => createBook(owner, input("Livro", "9788535902778"), { metadataReady: true })));
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(new Set(results.map(result => result.book.id)).size).toBe(1);
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
  });
  it("cadastros manuais concorrentes também não duplicam título/autor", async () => {
    const results = await Promise.all([createBook(owner, input(), { metadataReady: true }), createBook(owner, input(), { metadataReady: true })]);
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
  });
  it("o mesmo ISBN pode existir em bibliotecas diferentes", async () => {
    const results = await Promise.all([createBook(owner, input("Livro", "9788535902778"), { metadataReady: true }), createBook("library-integration-other", input("Livro", "9788535902778"), { metadataReady: true })]);
    expect(results.every(result => result.created)).toBe(true);
  });
  it("prévia do scanner não grava livros nem coleções", async () => {
    const result = await scanBook(owner, scanSchema.parse({ isbn: "9788535902778", preview: true }));
    expect(result).toMatchObject({ created: false, body: { existing: false, book: { title: "Livro do scanner" } } });
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(0);
    expect(await prisma.collection.count({ where: { userId: owner } })).toBe(0);
  });
  it("scanner e cadastro simultâneos usam a mesma deduplicação", async () => {
    const [scan, manual] = await Promise.all([
      scanBook(owner, scanSchema.parse({ isbn: "9788535902778" })),
      createBook(owner, input("Livro do scanner", "9788535902778"), { metadataReady: true }),
    ]);
    expect(Number(scan.created) + Number(manual.created)).toBe(1);
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
  });
  it("reordena atomicamente e rejeita livros de outro usuário", async () => {
    const first = await createBook(owner, input("Primeiro volume"), { metadataReady: true });
    const other = await createBook("library-integration-other", input("Segundo volume"), { metadataReady: true });
    await expect(reorderBooks(owner, reorderSchema.parse({ items: [{ id: first.book.id, customOrder: 2 }, { id: other.book.id, customOrder: 1 }] }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: first.book.id } })).customOrder).toBeNull();
    await reorderBooks(owner, { items: [{ id: first.book.id, customOrder: 2 }] });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: first.book.id } })).customOrder).toBe(2);
  });
  it("renomeia configurações e move a coleção dentro da mesma transação", async () => {
    await updateLibrarySettings(owner, settingsSchema.parse({ name: "Acervo inicial", yearlyGoal: 24 }));
    const created = await createBook(owner, input(), { metadataReady: true });
    await updateLibrarySettings(owner, settingsSchema.parse({ name: "Novo acervo" }));
    const book = await prisma.book.findUniqueOrThrow({ where: { id: created.book.id }, include: { collection: true } });
    expect(book.collection.name).toBe("Novo acervo");
    expect((await prisma.librarySetting.findUniqueOrThrow({ where: { userId: owner } })).yearlyGoal).toBe(24);
    expect(await prisma.collection.count({ where: { userId: owner, name: "Acervo inicial" } })).toBe(0);
  });
  it("falha na movimentação desfaz a renomeação inteira", async () => {
    await updateLibrarySettings(owner, settingsSchema.parse({ name: "Acervo inicial" }));
    const created = await createBook(owner, input(), { metadataReady: true });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION library_test_fail_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated move failure'; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER library_test_fail_move BEFORE UPDATE OF "collectionId" ON "Book" FOR EACH ROW EXECUTE FUNCTION library_test_fail_move()`);
    await expect(updateLibrarySettings(owner, settingsSchema.parse({ name: "Novo acervo" }))).rejects.toThrow();
    expect((await prisma.librarySetting.findUniqueOrThrow({ where: { userId: owner } })).name).toBe("Acervo inicial");
    expect((await prisma.book.findUniqueOrThrow({ where: { id: created.book.id }, include: { collection: true } })).collection.name).toBe("Acervo inicial");
  });
  it("enriquecimento preserva campos editados durante a busca externa", async () => {
    const created = await createBook(owner, input(), { metadataReady: true });
    provider.fields.mockImplementationOnce(async () => {
      await prisma.book.update({ where: { id: created.book.id }, data: { synopsis: "Sinopse manual", pages: 350 } });
      return { synopsis: "Sinopse externa", genre: "Ficção", pages: 120 };
    });
    const result = await enrichBooks(owner, created.book.id);
    expect(result.results[0]?.updated).toEqual(["genre"]);
    expect(await prisma.book.findUniqueOrThrow({ where: { id: created.book.id } })).toMatchObject({ synopsis: "Sinopse manual", pages: 350, genre: "Ficção" });
  });
  it("descarta metadados se título foi alterado durante a consulta", async () => {
    const created = await createBook(owner, input(), { metadataReady: true });
    provider.fields.mockImplementationOnce(async () => {
      await prisma.book.update({ where: { id: created.book.id }, data: { title: "Outro livro" } });
      return { synopsis: "Sinopse externa", genre: "Ficção", pages: 120 };
    });
    expect((await enrichBooks(owner, created.book.id)).enriched).toBe(0);
  });
  it("catálogo compartilhado não retorna notas e respeita revogação", async () => {
    const created = await createBook(owner, input(), { metadataReady: true });
    await prisma.book.update({ where: { id: created.book.id }, data: { notes: "Nota privada" } });
    const setting = await updateLibrarySettings(owner, settingsSchema.parse({ shareEnabled: true }));
    const shared = await getSharedCatalog(setting.shareId!);
    expect(shared?.books).toHaveLength(1);
    expect(JSON.stringify(shared)).not.toContain("Nota privada");
    expect(await getBookDetail("library-integration-other", created.book.id)).toBeNull();
    await updateLibrarySettings(owner, settingsSchema.parse({ shareEnabled: false }));
    expect(await getSharedCatalog(setting.shareId!)).toBeNull();
  });

  it("indexação atrasada não grava vetor de uma versão antiga", async () => {
    const created = await createBook(owner, input(), { metadataReady: true });
    const snapshot = await prisma.book.findUniqueOrThrow({ where: { id: created.book.id } });
    vi.mocked(generateEmbedding).mockImplementationOnce(async () => {
      await prisma.book.update({ where: { id: snapshot.id }, data: { title: "Título editado", updatedAt: new Date(snapshot.updatedAt.getTime() + 1000) } });
      return Array.from({ length: 1536 }, () => 0.1);
    });
    await refreshBookEmbedding(snapshot);
    const rows = await prisma.$queryRaw<{ indexed: boolean }[]>`SELECT embedding IS NOT NULL AS indexed FROM "Book" WHERE id = ${snapshot.id}`;
    expect(rows[0]?.indexed).toBe(false);
  });
});
