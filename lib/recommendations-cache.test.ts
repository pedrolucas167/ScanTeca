import { describe, it, expect, vi, beforeEach } from "vitest";

const getRedisMock = vi.fn();
vi.mock("./redis", () => ({
  getRedis: () => getRedisMock(),
}));

import {
  getCachedRecommendations,
  setCachedRecommendations,
  invalidateRecommendationsCache,
} from "./recommendations-cache";

const payload = {
  primary: null,
  queue: [],
  profile: {
    affinity: [],
    feedbackCount: 0,
    recommendationFeedbackCount: 0,
    calibration: 0,
  },
  books: [],
};

describe("recommendations-cache", () => {
  beforeEach(() => {
    getRedisMock.mockReset();
  });

  it("degrada para null quando Redis não está configurado", async () => {
    getRedisMock.mockReturnValue(null);

    await expect(getCachedRecommendations("u1")).resolves.toBeNull();
    await expect(setCachedRecommendations("u1", payload)).resolves.toBeUndefined();
    await expect(invalidateRecommendationsCache("u1")).resolves.toBeUndefined();
  });

  it("lê o payload cacheado com a chave recs:{userId}", async () => {
    const get = vi.fn().mockResolvedValue(payload);
    getRedisMock.mockReturnValue({ get });

    const result = await getCachedRecommendations("u1");

    expect(get).toHaveBeenCalledWith("recs:u1");
    expect(result).toEqual(payload);
  });

  it("grava com TTL de 1h", async () => {
    const set = vi.fn().mockResolvedValue("OK");
    getRedisMock.mockReturnValue({ set });

    await setCachedRecommendations("u1", payload);

    expect(set).toHaveBeenCalledWith("recs:u1", payload, { ex: 3600 });
  });

  it("invalida a chave do usuário", async () => {
    const del = vi.fn().mockResolvedValue(1);
    getRedisMock.mockReturnValue({ del });

    await invalidateRecommendationsCache("u1");

    expect(del).toHaveBeenCalledWith("recs:u1");
  });

  it("é fail-safe: erros do Redis não propagam", async () => {
    const failing = {
      get: vi.fn().mockRejectedValue(new Error("redis down")),
      set: vi.fn().mockRejectedValue(new Error("redis down")),
      del: vi.fn().mockRejectedValue(new Error("redis down")),
    };
    getRedisMock.mockReturnValue(failing);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getCachedRecommendations("u1")).resolves.toBeNull();
    await expect(setCachedRecommendations("u1", payload)).resolves.toBeUndefined();
    await expect(invalidateRecommendationsCache("u1")).resolves.toBeUndefined();
  });
});
