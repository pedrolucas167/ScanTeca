import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: async () => null, rateLimits: {} }));
import { POST } from "./route";
const metric = { id: "test", name: "LCP", value: 1800, rating: "good", path: "/" };
const recorded = vi.hoisted(() => vi.fn());
const request = (body: unknown) => new NextRequest("http://localhost/api/vitals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { recorded.mockClear(); vi.spyOn(console, "info").mockImplementation(recorded); });
afterEach(() => vi.restoreAllMocks());

it("continua aceitando o formato anterior de métricas", async () => {
  expect((await POST(request(metric))).status).toBe(204);
});
it("preserva apenas os dados permitidos de atribuição", async () => {
  expect((await POST(request({ ...metric, lcp: { element: "IMG", paintMs: 1800, resourceStartMs: 800, resourceEndMs: 1400, url: "private", text: "private" } }))).status).toBe(204);
  expect(recorded).toHaveBeenCalledWith("web-vital", { ...metric, lcp: { element: "IMG", paintMs: 1800, resourceStartMs: 800, resourceEndMs: 1400 } });
});
it("rejeita valores inválidos antes do registro", async () => {
  expect((await POST(request({ ...metric, lcp: { element: "IMG", paintMs: -1 } }))).status).toBe(400);
  expect(recorded).not.toHaveBeenCalled();
});
