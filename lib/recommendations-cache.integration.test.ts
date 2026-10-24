import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { localRedis } from "@/tests/redis-client";
const { client, command } = localRedis();
vi.mock("./redis", () => ({ getRedis: () => client }));
const builder = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock("./recommendations", () => ({ buildRecommendations: builder.build }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "cache-concurrency" }) }));
vi.mock("./rate-limit", () => ({ rateLimitGuard: async () => null, rateLimits: {} }));
import { getRecommendationsSnapshot, getCachedRecommendations, setCachedRecommendations, invalidateRecommendationsCache } from "./recommendations-cache";
import { GET } from "@/app/api/recommendations/route";
const user = "cache-concurrency";
const payload = { primary: null, queue: [], profile: { affinity: [], feedbackCount: 0, recommendationFeedbackCount: 0, calibration: 0 }, books: [] };
beforeEach(async () => {
  builder.build.mockReset();
  await command("DEL", `recs:${user}`, `recs:version:${user}`);
});
describe("cache de recomendações com Redis real", () => {
  it("reproduz geração antiga que reaparece após DEL no protocolo anterior", async () => {
    expect(await command("GET", `recs:${user}`)).toBeNull();
    await command("DEL", `recs:${user}`);
    await command("SET", `recs:${user}`, JSON.stringify(payload));
    expect(await command("GET", `recs:${user}`)).not.toBeNull();
  });
  it("invalidação durante build impede publicação velha pela rota", async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const building = new Promise<void>(resolve => { started = resolve; });
    builder.build.mockImplementation(async () => { started(); await gate; return payload; });
    const response = GET(new NextRequest("http://localhost/api/recommendations"));
    await building;
    await invalidateRecommendationsCache(user);
    release();
    expect((await response).status).toBe(200);
    expect(await getCachedRecommendations(user)).toBeNull();
  });
  it("publicação e invalidação concorrentes terminam com cache vazio", async () => {
    const old = await getRecommendationsSnapshot(user);
    await Promise.all([setCachedRecommendations(user, payload, old.version), invalidateRecommendationsCache(user)]);
    expect(await getCachedRecommendations(user)).toBeNull();
    expect(await setCachedRecommendations(user, payload, old.version)).toBe(false);
    const fresh = await getRecommendationsSnapshot(user);
    expect(await setCachedRecommendations(user, payload, fresh.version)).toBe(true);
    expect(await getCachedRecommendations(user)).toEqual(payload);
    expect(await command("TTL", `recs:${user}`)).toBeGreaterThan(3500);
    expect(await command("TTL", `recs:version:${user}`)).toBeGreaterThan(7100);
  });
  it("expiração da versão não permite ABA nem ressuscita payload", async () => {
    const old = await getRecommendationsSnapshot(user);
    await command("DEL", `recs:version:${user}`);
    expect(await setCachedRecommendations(user, payload, old.version)).toBe(false);
    const fresh = await getRecommendationsSnapshot(user);
    expect(fresh.version).not.toBe(old.version);
    expect(await setCachedRecommendations(user, payload, old.version)).toBe(false);
  });
  it("a rota ainda retorna HIT após publicação válida", async () => {
    const snapshot = await getRecommendationsSnapshot(user);
    await setCachedRecommendations(user, payload, snapshot.version);
    const response = await GET(new NextRequest("http://localhost/api/recommendations"));
    expect(response.headers.get("X-Cache")).toBe("HIT");
    expect(builder.build).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(payload);
  });
});
