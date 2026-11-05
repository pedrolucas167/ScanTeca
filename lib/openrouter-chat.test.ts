import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
vi.mock("./redis", () => ({ getRedis: () => null }));
import { fetchWithTimeout } from "./fetch-with-timeout";
import { openRouterChat } from "./openrouter-chat";
const models = ["fixture/alpha:free", "fixture/beta:free"];
const input = () => ({ apiKey: crypto.randomUUID(), body: { model: "fixture/paid", messages: [{ role: "user", content: "Dados fictícios" }] } });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("ORACLE_FREE_MODELS", models.join(",")); });
afterEach(() => vi.unstubAllEnvs());
it("keeps fixed-model requests unchanged when free rotation is disabled", async () => {
  vi.stubEnv("ORACLE_FREE_MODELS", "");
  vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response("ok"));
  await openRouterChat(input());
  expect(JSON.parse(String(vi.mocked(fetchWithTimeout).mock.calls[0]?.[1]?.body)).model).toBe("fixture/paid");
});
it("rotates and bounds failover to free models, cancelling the rejected body", async () => {
  const cancel = vi.fn();
  vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response(new ReadableStream({ cancel }), { status: 503 })).mockResolvedValueOnce(new Response("ok"));
  const data = input();
  const result = await openRouterChat({ ...data, body: { ...data.body, models: ["fixture/paid"] } });
  expect(result.ok).toBe(true);
  expect(cancel).toHaveBeenCalledOnce();
  const bodies = vi.mocked(fetchWithTimeout).mock.calls.map(call => JSON.parse(String(call[1]?.body)));
  expect(bodies.map(body => body.model)).toEqual(models);
  expect(bodies.every(body => body.models === undefined && body.provider.max_price.prompt === 0)).toBe(true);
});
it("does not rotate away from account-wide rate limits or credential errors", async () => {
  for (const status of [429, 401, 402]) {
    vi.mocked(fetchWithTimeout).mockClear().mockResolvedValueOnce(Response.json({ error: { message: "Limit" } }, { status }));
    expect((await openRouterChat(input())).status).toBe(status);
    expect(fetchWithTimeout).toHaveBeenCalledOnce();
  }
});
it("allows one failover for an explicitly upstream provider limit", async () => {
  vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ error: { metadata: { provider_name: "Fixture" } } }, { status: 429 })).mockResolvedValueOnce(new Response("ok"));
  expect((await openRouterChat(input())).ok).toBe(true);
  expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
});
it("disables optional reasoning for the verified low-latency Nemotron candidate", async () => {
  vi.stubEnv("ORACLE_FREE_MODELS", "nvidia/nemotron-3.5-lightning:free");
  vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response("ok"));
  await openRouterChat(input());
  const body = JSON.parse(String(vi.mocked(fetchWithTimeout).mock.calls[0]?.[1]?.body));
  expect(body.reasoning).toEqual({ enabled: false });
});
it("does not send a request after cancellation or when the local quota is spent", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(openRouterChat({ ...input(), signal: controller.signal })).rejects.toThrow();
  expect(fetchWithTimeout).not.toHaveBeenCalled();
  vi.stubEnv("ORACLE_FREE_DAILY_LIMIT", "1");
  vi.mocked(fetchWithTimeout).mockResolvedValueOnce(new Response("ok"));
  const data = input();
  await openRouterChat(data);
  expect((await openRouterChat(data)).status).toBe(429);
  expect(fetchWithTimeout).toHaveBeenCalledOnce();
});
