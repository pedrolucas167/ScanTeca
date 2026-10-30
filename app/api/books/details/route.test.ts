import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), details: vi.fn(), limit: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/modules/library", () => ({ getCatalogDetails: mocks.details }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: mocks.limit, rateLimits: {} }));
import { GET } from "./route";
const request = (query = "") => new NextRequest(`http://localhost/api/books/details${query}`);
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.limit.mockResolvedValue(null); mocks.details.mockResolvedValue([]); });
afterEach(() => vi.restoreAllMocks());

it("recusa acesso anônimo antes de consultar dados", async () => {
  mocks.auth.mockResolvedValue({ userId: null });
  expect((await GET(request())).status).toBe(401);
  expect(mocks.details).not.toHaveBeenCalled();
});
it("preserva rate limit antes de consultar dados", async () => {
  mocks.limit.mockResolvedValue(NextResponse.json({}, { status: 429 }));
  expect((await GET(request())).status).toBe(429);
  expect(mocks.details).not.toHaveBeenCalled();
});
it("retorna 404 para livro ausente no acervo do usuário", async () => {
  expect((await GET(request("?id=other-book&userId=other-user"))).status).toBe(404);
  expect(mocks.details).toHaveBeenCalledWith("owner", "other-book");
});
it("exporta somente dados da sessão e impede cache compartilhado", async () => {
  mocks.details.mockResolvedValue([{ id: "own-book", notes: "Privado" }]);
  const response = await GET(request("?userId=other-user"));
  expect(mocks.details).toHaveBeenCalledWith("owner", undefined);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ books: [{ id: "own-book", notes: "Privado" }] });
});
it("rejeita identificador vazio", async () => {
  expect((await GET(request("?id="))).status).toBe(400);
  expect(mocks.details).not.toHaveBeenCalled();
});
it("retorna erro sem divulgar detalhes internos", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.details.mockRejectedValue(new Error("internal"));
  const response = await GET(request());
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("internal");
});
