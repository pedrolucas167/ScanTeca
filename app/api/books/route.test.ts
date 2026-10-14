import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: {} }));
vi.mock("@/modules/library", async importOriginal => ({
  ...await importOriginal<typeof import("@/modules/library")>(),
  createBook: vi.fn(), updateBook: vi.fn(), deleteBook: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import { createBook, updateBook, LibraryError } from "@/modules/library";
import { POST, PATCH, DELETE } from "./route";

const request = (method: string, body: unknown) => new NextRequest("http://localhost/api/books?id=b1", {
  method, body: JSON.stringify(body), headers: { "content-type": "application/json" },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
});

it("bloqueia todos os comandos sem autenticação", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  for (const [handler, method] of [[POST, "POST"], [PATCH, "PATCH"], [DELETE, "DELETE"]] as const) {
    expect((await handler(request(method, {}))).status).toBe(401);
  }
  expect(createBook).not.toHaveBeenCalled();
});

it("mantém o rate limit antes de executar a operação", async () => {
  vi.mocked(rateLimitGuard).mockResolvedValue(NextResponse.json({ error: "limit" }, { status: 429 }));
  expect((await POST(request("POST", { title: "Duna" }))).status).toBe(429);
  expect(createBook).not.toHaveBeenCalled();
});

it.each([true, false])("preserva status e payload de cadastro (created=%s)", async created => {
  vi.mocked(createBook).mockResolvedValue({ book: { id: "b1", collection: "Estante" }, message: "ok", created } as never);
  const response = await POST(request("POST", { title: "Duna" }));
  expect(response.status).toBe(created ? 201 : 200);
  expect(await response.json()).toEqual({ book: { id: "b1", collection: "Estante" }, message: "ok" });
  expect(createBook).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Duna" }));
});

it("rejeita entrada inválida antes de chamar Biblioteca", async () => {
  expect((await PATCH(request("PATCH", { currentPage: 35 }))).status).toBe(400);
  expect(updateBook).not.toHaveBeenCalled();
});

it.each([["NOT_FOUND", 404], ["CONFLICT", 409]] as const)("traduz %s para HTTP %s", async (code, status) => {
  vi.mocked(updateBook).mockRejectedValue(new LibraryError(code, "erro"));
  const response = await PATCH(request("PATCH", { id: "b1", currentPage: 35 }));
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: "erro" });
});
