import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: { scan: { userLimit: 10, ipLimit: 30 } } }));
vi.mock("@/modules/library", async importOriginal => ({ ...await importOriginal<typeof import("@/modules/library")>(), scanBook: vi.fn() }));
import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import { scanBook, LibraryError } from "@/modules/library";
import { POST } from "./route";
const request = (body: unknown) => new NextRequest("http://localhost/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
});
it("rejeita scanner sem autenticação", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  expect((await POST(request({ isbn: "9788535902778" }))).status).toBe(401);
  expect(scanBook).not.toHaveBeenCalled();
});
it.each([false, true])("mantém status e payload da prévia/cadastro (created=%s)", async created => {
  vi.mocked(scanBook).mockResolvedValue({ created, body: { book: { title: "Livro" }, message: "ok" } } as never);
  const response = await POST(request({ isbn: "9788535902778", preview: !created }));
  expect(response.status).toBe(created ? 201 : 200);
  expect(await response.json()).toEqual({ book: { title: "Livro" }, message: "ok" });
  expect(scanBook).toHaveBeenCalledWith("u1", expect.objectContaining({ preview: !created }));
});
it("traduz ISBN inválido para 400", async () => {
  vi.mocked(scanBook).mockRejectedValue(new LibraryError("INVALID_INPUT", "ISBN inválido"));
  expect((await POST(request({ isbn: "x" }))).status).toBe(400);
});
