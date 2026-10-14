import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: {
  "books/reorder": { userLimit: 10, ipLimit: 30, windowMs: 60000 },
} }));
vi.mock("@/modules/library", async importOriginal => ({
  ...await importOriginal<typeof import("@/modules/library")>(), reorderBooks: vi.fn(),
}));
import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import { reorderBooks, LibraryError } from "@/modules/library";
import { PATCH } from "./route";
const items = [{ id: "b1", customOrder: 0 }, { id: "b2", customOrder: 1 }];
const request = (value: unknown) => new NextRequest("http://localhost/api/books/reorder", {
  method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: value }),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
});
it("rejeita anônimo", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  expect((await PATCH(request(items))).status).toBe(401);
  expect(reorderBooks).not.toHaveBeenCalled();
});
it("aplica o rate limit específico antes da operação", async () => {
  vi.mocked(rateLimitGuard).mockResolvedValue(NextResponse.json({}, { status: 429 }));
  expect((await PATCH(request(items))).status).toBe(429);
  expect(rateLimitGuard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userLimit: 10, ipLimit: 30 }));
  expect(reorderBooks).not.toHaveBeenCalled();
});
it.each([{ value: [{ id: "b1" }] }, { value: [items[0], items[0]] }])("rejeita entrada inválida ou duplicada", async ({ value }) => {
  expect((await PATCH(request(value))).status).toBe(400);
  expect(reorderBooks).not.toHaveBeenCalled();
});
it("traduz livro de outro usuário para 404", async () => {
  vi.mocked(reorderBooks).mockRejectedValue(new LibraryError("NOT_FOUND", "Livro não encontrado"));
  expect((await PATCH(request(items))).status).toBe(404);
});
it("preserva o payload e a identidade", async () => {
  vi.mocked(reorderBooks).mockResolvedValue({ updated: 2 });
  const response = await PATCH(request(items));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ updated: 2 });
  expect(reorderBooks).toHaveBeenCalledWith("u1", { items });
});
