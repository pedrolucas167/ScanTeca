import { beforeEach, expect, test, vi } from "vitest";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: query } }));
import { GET } from "./route";

beforeEach(() => { query.mockReset(); });

test("readiness confirma banco e impede cache da resposta", async () => {
  query.mockResolvedValue([{ "?column?": 1 }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});

test("banco indisponível retorna 503 sem expor detalhes da conexão", async () => {
  query.mockRejectedValue(new Error("private database connection details"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "unavailable" });
});
