import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  transaction: vi.fn(), executeRaw: vi.fn(), txExecuteRaw: vi.fn(),
  txFind: vi.fn(), txUpdate: vi.fn(), logFind: vi.fn(), logUpsert: vi.fn(),
  embedding: vi.fn(), cover: vi.fn(), synopsis: vi.fn(), originalYear: vi.fn(),
  similar: vi.fn(), collection: vi.fn(), invalidate: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  book: { findFirst: mocks.findFirst, findUnique: mocks.findUnique, create: mocks.create, update: mocks.update, delete: mocks.delete },
  $transaction: mocks.transaction, $executeRaw: mocks.executeRaw,
} }));
vi.mock("@/lib/embeddings", () => ({ generateEmbedding: mocks.embedding, bookToEmbeddingText: () => "book" }));
vi.mock("@/lib/book-cover", () => ({ findBookCover: mocks.cover }));
vi.mock("@/lib/synopsis", () => ({ findSynopsis: mocks.synopsis, cleanSynopsis: (value: string) => value || null }));
vi.mock("@/lib/original-date", () => ({ findOriginalPublishYear: mocks.originalYear, extractYear: () => null }));
vi.mock("./collections", () => ({ resolveCollection: mocks.collection }));
vi.mock("@/lib/recommendations-cache", () => ({ invalidateRecommendationsCache: mocks.invalidate }));
vi.mock("@/lib/push", () => ({ notifyGoalIfReached: mocks.notify }));
vi.mock("./duplicates", () => ({ findExistingBookByTitleAuthor: mocks.similar }));

import { createBook, updateBook, deleteBook } from "./service";
import { bookCreateSchema, bookUpdateSchema } from "./contracts";

const book = {
  id: "b1", userId: "u1", isbn: "9788535902778", title: "Duna", author: "Frank Herbert",
  status: "READING", currentPage: 20, startedAt: null, finishedAt: null,
  readCount: 0, reclubeCount: 0, collection: { name: "Estante" },
};
const tx = {
  book: { findFirst: mocks.txFind, update: mocks.txUpdate, findUnique: mocks.findUnique, create: mocks.create },
  readingLog: { findUnique: mocks.logFind, upsert: mocks.logUpsert },
  $executeRaw: mocks.txExecuteRaw,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findFirst.mockResolvedValue(book);
  mocks.txFind.mockResolvedValue(book);
  mocks.txUpdate.mockImplementation(async ({ data }) => ({ ...book, ...data }));
  mocks.transaction.mockImplementation(async callback => callback(tx));
  mocks.embedding.mockResolvedValue(null);
  mocks.collection.mockResolvedValue({ id: "c1" });
  mocks.notify.mockResolvedValue(undefined);
});

describe("Biblioteca", () => {
  it("traduz contenção do lock de cadastro para conflito recuperável", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("lock timeout", {
      code: "P2010", clientVersion: "6.19.3", meta: { code: "55P03" },
    }));
    await expect(createBook("u1", bookCreateSchema.parse({ title: "Duna" }), { metadataReady: true }))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("devolve duplicata por ISBN sem enriquecer ou criar outro livro", async () => {
    mocks.findUnique.mockResolvedValue(book);
    const result = await createBook("u1", bookCreateSchema.parse({ title: "Duna", isbn: book.isbn }));
    expect(result).toMatchObject({ created: false, book: { collection: "Estante" } });
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { isbn_userId: { isbn: book.isbn, userId: "u1" } },
    }));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.cover).not.toHaveBeenCalled();
  });

  it("impede edição e exclusão de livro de outro usuário", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(updateBook("u2", bookUpdateSchema.parse({ id: "b1", notes: "x" })))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteBook("u2", "b1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "b1", userId: "u2" } });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("grava livro e diário na mesma transação sem buscar capa ao mudar progresso", async () => {
    const result = await updateBook("u1", bookUpdateSchema.parse({ id: "b1", currentPage: 35, sessionNote: " Ótimo " }));
    expect(result.book.currentPage).toBe(35);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.logUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ pages: 15, note: "Ótimo", userId: "u1", bookId: "b1" }),
    }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.cover).not.toHaveBeenCalled();
  });

  it("não confirma a operação nem envia push se a gravação do diário falhar", async () => {
    mocks.logUpsert.mockRejectedValue(new Error("database unavailable"));
    await expect(updateBook("u1", bookUpdateSchema.parse({ id: "b1", status: "READ", currentPage: 35 })))
      .rejects.toThrow("database unavailable");
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("refaz a leitura após conflito, sem contar novamente páginas já gravadas", async () => {
    mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034", clientVersion: "6.19.3",
    }));
    mocks.txFind.mockResolvedValue({ ...book, currentPage: 35 });
    await updateBook("u1", bookUpdateSchema.parse({ id: "b1", currentPage: 35 }));
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.logUpsert).not.toHaveBeenCalled();
  });

  it("limita retentativas e retorna conflito recuperável", async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034", clientVersion: "6.19.3",
    }));
    await expect(updateBook("u1", bookUpdateSchema.parse({ id: "b1", currentPage: 35 })))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  });

  it("não transforma falha de indexação em falha de um cadastro já salvo", async () => {
    mocks.create.mockResolvedValue(book);
    mocks.embedding.mockResolvedValue([0.1, 0.2]);
    mocks.executeRaw.mockRejectedValue(new Error("vector unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await createBook("u1", bookCreateSchema.parse({ title: "Duna" }));
      expect(result.created).toBe(true);
      expect(mocks.invalidate).toHaveBeenCalledWith("u1");
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
