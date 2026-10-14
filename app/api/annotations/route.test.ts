import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/modules/reading", async importOriginal => ({
  ...await importOriginal<typeof import("@/modules/reading")>(), createAnnotation: vi.fn(),
}));
import { auth } from "@clerk/nextjs/server";
import { createAnnotation, ReadingError } from "@/modules/reading";
import { POST } from "./route";
const request = (body: unknown) => new NextRequest("http://localhost/api/annotations", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
});
it("rejeita anônimo", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  expect((await POST(request({}))).status).toBe(401);
  expect(createAnnotation).not.toHaveBeenCalled();
});
it("retorna 400 para anotação inválida em vez de erro de servidor", async () => {
  expect((await POST(request({ bookId: "b1", paragraph: -1, content: " " }))).status).toBe(400);
  expect(createAnnotation).not.toHaveBeenCalled();
});
it("preserva o payload e transmite a identidade autenticada", async () => {
  vi.mocked(createAnnotation).mockResolvedValue({ id: "a1" } as never);
  const response = await POST(request({ bookId: "b1", paragraph: 1, content: "Nota" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: "a1" });
  expect(createAnnotation).toHaveBeenCalledWith("u1", expect.objectContaining({ bookId: "b1", type: "comment" }));
});
it("retorna 404 quando livro pertence a outro usuário", async () => {
  vi.mocked(createAnnotation).mockRejectedValue(new ReadingError("Livro não encontrado", "NOT_FOUND"));
  expect((await POST(request({ bookId: "b1", paragraph: 1, content: "Nota" }))).status).toBe(404);
});
