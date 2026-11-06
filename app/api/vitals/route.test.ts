import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { analyticsChoices, analyticsCookie } from "@/lib/analytics-preference";
import { POST } from "./route";

const redis = vi.hoisted(() => ({ eval: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getRedis: () => redis }));

const origin = "https://scanteca.example";
const performance = { page: "manifesto", name: "LCP", rating: "good" };
const usage = { page: "home", name: "page_view" };

function request(body: unknown, preference = analyticsChoices.accepted as string, source = origin) {
  return new NextRequest(`${origin}/api/vitals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: source,
      ...(preference ? { cookie: `${analyticsCookie}=${preference}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  redis.eval.mockReset().mockResolvedValue(1);
  vi.useFakeTimers().setSystemTime(new Date("2026-11-05T18:30:00Z"));
});

afterEach(() => vi.useRealTimers());

it("ignora acessos diretos sem aceite, após revogação ou de outra origem", async () => {
  for (const call of [
    request(usage, ""),
    request(usage, analyticsChoices.rejected),
    request(usage, "obsolete-accepted"),
    request(usage, analyticsChoices.accepted, "https://external.example"),
  ]) {
    expect((await POST(call)).status).toBe(403);
  }
  expect(redis.eval).not.toHaveBeenCalled();
});

it("rejeita campos extras e páginas que poderiam revelar identificadores", async () => {
  for (const body of [
    { ...performance, id: "private-fixture" },
    { ...performance, page: "/perfil/private-fixture" },
    { ...usage, url: "https://external.example/private-fixture" },
    { ...performance, rating: 1200 },
  ]) {
    expect((await POST(request(body))).status).toBe(400);
  }
  expect(redis.eval).not.toHaveBeenCalled();
});

it("armazena só o dia e a categoria dos eventos com expiração fixa", async () => {
  expect((await POST(request(performance))).status).toBe(204);
  expect((await POST(request(usage))).status).toBe(204);
  const expiration = Date.parse("2026-12-05T00:00:00Z") / 1000;
  expect(redis.eval.mock.calls.map(([, keys, args]) => [keys, args])).toEqual([
    [["analytics:v1:2026-11-05"], ["manifesto:LCP:good", expiration]],
    [["analytics:v1:2026-11-05"], ["home:page_view", expiration]],
  ]);
});

it("reprova quando o limite do contador é atingido ou o Redis falha", async () => {
  redis.eval.mockResolvedValueOnce(0).mockRejectedValueOnce(new Error("offline"));
  expect((await POST(request(usage))).status).toBe(429);
  expect((await POST(request(usage))).status).toBe(503);
});
