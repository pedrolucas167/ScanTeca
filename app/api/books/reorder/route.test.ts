import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    book: { count: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitGuard: vi.fn(),
  rateLimits: {
    "books/reorder": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  },
}));

import { PATCH } from "./route";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard } from "@/lib/rate-limit";

const authMock = vi.mocked(auth);
const countMock = vi.mocked(prisma.book.count);
const updateMock = vi.mocked(prisma.book.update);
const transactionMock = vi.mocked(prisma.$transaction);
const guardMock = vi.mocked(rateLimitGuard);

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/books/reorder", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const items = [
  { id: "b1", customOrder: 0 },
  { id: "b2", customOrder: 1 },
];

describe("PATCH /api/books/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "u1" } as never);
    guardMock.mockResolvedValue(null);
  });

  it("retorna 401 sem autenticação", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await PATCH(makeRequest({ items }));

    expect(res.status).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("propaga a resposta do rate limit", async () => {
    guardMock.mockResolvedValue(
      NextResponse.json({ error: "Muitas requisições" }, { status: 429 })
    );

    const res = await PATCH(makeRequest({ items }));

    expect(res.status).toBe(429);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("retorna 400 com body inválido", async () => {
    const res = await PATCH(makeRequest({ items: [{ id: "b1" }] }));

    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("retorna 404 quando algum livro não pertence ao usuário", async () => {
    countMock.mockResolvedValue(1); // só 1 dos 2 é do usuário

    const res = await PATCH(makeRequest({ items }));

    expect(res.status).toBe(404);
    expect(countMock).toHaveBeenCalledWith({
      where: { userId: "u1", id: { in: ["b1", "b2"] } },
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("atualiza todos os itens numa transação", async () => {
    countMock.mockResolvedValue(2);
    updateMock.mockImplementation((args) => args as never);
    transactionMock.mockResolvedValue([] as never);

    const res = await PATCH(makeRequest({ items }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 2 });
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { customOrder: 0 },
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
