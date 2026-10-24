import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ getRedis: vi.fn() }));
vi.mock("./redis", () => ({ getRedis: mocks.getRedis }));
import { getCachedRecommendations, getRecommendationsSnapshot, setCachedRecommendations, invalidateRecommendationsCache } from "./recommendations-cache";
const payload = { primary: null, queue: [], profile: { affinity: [], feedbackCount: 0, recommendationFeedbackCount: 0, calibration: 0 }, books: [] };
beforeEach(() => { mocks.getRedis.mockReset(); });
afterEach(() => vi.restoreAllMocks());
describe("recommendations-cache fallback", () => {
  it("sem Redis gera sem cache e nunca publica sem token", async () => {
    mocks.getRedis.mockReturnValue(null);
    expect(await getRecommendationsSnapshot("u")).toEqual({ payload: null, version: null });
    expect(await getCachedRecommendations("u")).toBeNull();
    expect(await setCachedRecommendations("u", payload, null)).toBe(false);
    await expect(invalidateRecommendationsCache("u")).resolves.toBeUndefined();
  });
  it("falha de leitura não ganha um token de publicação posteriormente", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const evaluate = vi.fn().mockRejectedValueOnce(new Error("Redis down"));
    mocks.getRedis.mockReturnValue({ eval: evaluate });
    const snapshot = await getRecommendationsSnapshot("u");
    expect(snapshot.version).toBeNull();
    evaluate.mockResolvedValue(1);
    expect(await setCachedRecommendations("u", payload, snapshot.version)).toBe(false);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
  it("erros de publicação e invalidação não propagam", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getRedis.mockReturnValue({ eval: vi.fn().mockRejectedValue(new Error("Redis down")) });
    expect(await setCachedRecommendations("u", payload, "generation")).toBe(false);
    await expect(invalidateRecommendationsCache("u")).resolves.toBeUndefined();
  });
  it("aceita a desserialização automática do Upstash e valores JSON brutos", async () => {
    const evaluate = vi.fn().mockResolvedValueOnce(["version", payload]).mockResolvedValueOnce(["version", JSON.stringify(payload)]);
    mocks.getRedis.mockReturnValue({ eval: evaluate });
    expect(await getCachedRecommendations("u")).toEqual(payload);
    expect(await getCachedRecommendations("u")).toEqual(payload);
  });
});