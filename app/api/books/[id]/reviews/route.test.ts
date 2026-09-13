import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    book: { findUnique: vi.fn() },
    librarySetting: { findFirst: vi.fn() },
    review: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitGuard: vi.fn(),
  rateLimits: {
    "books/reviews": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  },
}));

import { GET, POST } from "./route";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard } from "@/lib/rate-limit";

const authMock = vi.mocked(auth);
const currentUserMock = vi.mocked(currentUser);
const findBookMock = vi.mocked(prisma.book.findUnique);
const findSettingMock = vi.mocked(prisma.librarySetting.findFirst);
const findReviewsMock = vi.mocked(prisma.review.findMany);
const createReviewMock = vi.mocked(prisma.review.create);
const guardMock = vi.mocked(rateLimitGuard);

const params = Promise.resolve({ id: "b1" });

function makeRequest(method = "GET", body?: unknown) {
  return new NextRequest("http://localhost/api/books/b1/reviews", {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const book = { id: "b1", userId: "owner" };

describe("GET /api/books/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMock.mockResolvedValue(null);
    findReviewsMock.mockResolvedValue([]);
  });

  it("retorna reviews para o dono do livro", async () => {
    authMock.mockResolvedValue({ userId: "owner" } as never);
    findBookMock.mockResolvedValue(book as never);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(200);
    expect(findSettingMock).not.toHaveBeenCalled();
  });

  it("retorna reviews para visitante quando a biblioteca é compartilhada", async () => {
    authMock.mockResolvedValue({ userId: "visitor" } as never);
    findBookMock.mockResolvedValue(book as never);
    findSettingMock.mockResolvedValue({ id: "s1" } as never);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(200);
    expect(findSettingMock).toHaveBeenCalledWith({
      where: { userId: "owner", shareEnabled: true },
      select: { id: true },
    });
  });

  it("retorna reviews sem auth quando a biblioteca é compartilhada", async () => {
    authMock.mockResolvedValue({ userId: null } as never);
    findBookMock.mockResolvedValue(book as never);
    findSettingMock.mockResolvedValue({ id: "s1" } as never);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(200);
  });

  it("retorna 404 para visitante quando a biblioteca não é compartilhada", async () => {
    authMock.mockResolvedValue({ userId: "visitor" } as never);
    findBookMock.mockResolvedValue(book as never);
    findSettingMock.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(404);
  });

  it("retorna 404 para anônimo quando a biblioteca não é compartilhada", async () => {
    authMock.mockResolvedValue({ userId: null } as never);
    findBookMock.mockResolvedValue(book as never);
    findSettingMock.mockResolvedValue(null);

    const res = await GET(makeRequest(), { params });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/books/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMock.mockResolvedValue(null);
    currentUserMock.mockResolvedValue({
      fullName: "Maria Leitora",
      firstName: "Maria",
      username: "maria",
    } as never);
    createReviewMock.mockImplementation((args) => args.data as never);
  });

  it("retorna 401 sem autenticação", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await POST(makeRequest("POST", { content: "Ótimo" }), {
      params,
    });

    expect(res.status).toBe(401);
    expect(createReviewMock).not.toHaveBeenCalled();
  });

  it("dono publica review com nome derivado do Clerk", async () => {
    authMock.mockResolvedValue({ userId: "owner" } as never);
    findBookMock.mockResolvedValue(book as never);

    const res = await POST(makeRequest("POST", { content: "Ótimo" }), {
      params,
    });

    expect(res.status).toBe(201);
    expect(createReviewMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookId: "b1",
        userId: "owner",
        userName: "Maria Leitora",
      }),
    });
  });

  it("visitante logado publica review em biblioteca compartilhada", async () => {
    authMock.mockResolvedValue({ userId: "visitor" } as never);
    findBookMock.mockResolvedValue(book as never);
    findSettingMock.mockResolvedValue({ id: "s1" } as never);

    const res = await POST(makeRequest("POST", { content: "Ótimo" }), {
      params,
    });

    expect(res.status).toBe(201);
    expect(createReviewMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "visitor" }),
    });
  });

  it("retorna 404 para visitante em biblioteca não compartilhada", async () => {
    authMock.mockResolvedValue({ userId: "visitor" } as never);
    findBookMock.mockResolvedValue(book as never);
    findSettingMock.mockResolvedValue(null);

    const res = await POST(makeRequest("POST", { content: "Ótimo" }), {
      params,
    });

    expect(res.status).toBe(404);
    expect(createReviewMock).not.toHaveBeenCalled();
  });
});
