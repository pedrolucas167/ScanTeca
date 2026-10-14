import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: {
  "books/enrich": { userLimit: 5, ipLimit: 15, windowMs: 60000 },
} }));
vi.mock("@/modules/library", async importOriginal => ({ ...await importOriginal<typeof import("@/modules/library")>(), enrichBooks: vi.fn() }));
import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import { enrichBooks, LibraryError } from "@/modules/library";
import { POST } from "./route";
const request = () => new NextRequest("http://localhost/api/books/enrich", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId: "b1" }) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
});
it("rejeita usuário anônimo", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  expect((await POST(request())).status).toBe(401);
  expect(enrichBooks).not.toHaveBeenCalled();
});
it("usa os limites de enriquecimento e preserva o contrato", async () => {
  const result = { total: 1, enriched: 0, results: [] };
  vi.mocked(enrichBooks).mockResolvedValue(result);
  expect(await (await POST(request())).json()).toEqual(result);
  expect(enrichBooks).toHaveBeenCalledWith("u1", "b1");
  expect(rateLimitGuard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userLimit: 5, ipLimit: 15 }));
});
it("retorna 404 para livro de outro usuário", async () => {
  vi.mocked(enrichBooks).mockRejectedValue(new LibraryError("NOT_FOUND", "Livro não encontrado"));
  expect((await POST(request())).status).toBe(404);
});
