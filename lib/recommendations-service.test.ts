import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ build: vi.fn(), snapshot: vi.fn(), publish: vi.fn() }));
vi.mock("./recommendations", () => ({ buildRecommendations: mocks.build }));
vi.mock("./recommendations-cache", () => ({
  getRecommendationsSnapshot: mocks.snapshot,
  setCachedRecommendations: mocks.publish,
}));
import { getRecommendations } from "./recommendations-service";

const payload = { primary: null, queue: [], profile: { affinity: [], feedbackCount: 0, recommendationFeedbackCount: 0, calibration: 0 }, books: [] };
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

it("retorna cache do usuário sem chamar IA nem republicar", async () => {
  mocks.snapshot.mockResolvedValue({ payload, version: "v1" });
  expect(await getRecommendations("reader")).toEqual({ data: payload, cache: "HIT" });
  expect(mocks.snapshot).toHaveBeenCalledWith("reader");
  expect(mocks.build).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});

it("publica com a versão obtida antes da geração", async () => {
  mocks.snapshot.mockResolvedValue({ payload: null, version: "v1" });
  mocks.build.mockResolvedValue(payload);
  mocks.publish.mockResolvedValue(true);
  expect(await getRecommendations("reader")).toEqual({ data: payload, cache: "MISS" });
  expect(mocks.build).toHaveBeenCalledWith("reader");
  expect(mocks.publish).toHaveBeenCalledWith("reader", payload, "v1");
  expect(mocks.snapshot.mock.invocationCallOrder[0]!).toBeLessThan(mocks.build.mock.invocationCallOrder[0]!);
});

it("retorna resultado mesmo se uma invalidação impedir publicação", async () => {
  mocks.snapshot.mockResolvedValue({ payload: null, version: "old" });
  mocks.build.mockResolvedValue(payload);
  mocks.publish.mockResolvedValue(false);
  expect((await getRecommendations("reader")).data).toEqual(payload);
  expect(mocks.publish).toHaveBeenCalledWith("reader", payload, "old");
});

it("não publica uma geração que falhou", async () => {
  mocks.snapshot.mockResolvedValue({ payload: null, version: null });
  mocks.build.mockRejectedValue(new Error("unavailable"));
  await expect(getRecommendations("reader")).rejects.toThrow("unavailable");
  expect(mocks.publish).not.toHaveBeenCalled();
});

it("limita leitura travada do cache e não publica sem versão", async () => {
  vi.useFakeTimers();
  mocks.snapshot.mockReturnValue(new Promise(() => {}));
  mocks.build.mockResolvedValue(payload);
  const result = getRecommendations("reader");
  await vi.advanceTimersByTimeAsync(200);
  expect(await result).toEqual({ data: payload, cache: "MISS" });
  expect(mocks.publish).not.toHaveBeenCalled();
});

it("não prende a resposta esperando uma gravação travada", async () => {
  vi.useFakeTimers();
  mocks.snapshot.mockResolvedValue({ payload: null, version: "v1" });
  mocks.build.mockResolvedValue(payload);
  mocks.publish.mockReturnValue(new Promise(() => {}));
  const result = getRecommendations("reader");
  await vi.advanceTimersByTimeAsync(200);
  expect((await result).data).toEqual(payload);
});
