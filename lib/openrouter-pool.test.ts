import { afterEach, describe, expect, it, vi } from "vitest";
import { createModelPool, parseFreeModels, PoolUnavailable } from "./openrouter-pool";

afterEach(() => vi.unstubAllEnvs());
const models = ["fixture/alpha:free", "fixture/beta:free", "fixture/gamma:free"];
function pool(options: Partial<Parameters<typeof createModelPool>[0]> = {}) {
  return createModelPool({ apiKey: crypto.randomUUID(), models, redis: null, ...options });
}
describe("free model reservations", () => {
  it("rejects paid IDs and deduplicates explicit free variants", () => {
    expect(parseFreeModels("fixture/alpha:free, fixture/alpha:free")).toEqual([models[0]]);
    expect(() => parseFreeModels("fixture/paid")).toThrow();
    expect(() => parseFreeModels("openrouter/free")).toThrow();
    expect(() => parseFreeModels(",")).toThrow();
  });
  it("rotates concurrent development requests and enforces a rolling shared minute cap", async () => {
    let time = 100000;
    const instance = pool({ now: () => time, rpm: 3 });
    expect(await Promise.all([instance.reserve(), instance.reserve(), instance.reserve()])).toEqual(models);
    await expect(instance.reserve()).rejects.toBeInstanceOf(PoolUnavailable);
    time += 60000;
    expect(await instance.reserve()).toBe(models[0]);
  });
  it("shares quota across pool configurations and resets the daily cap at UTC midnight", async () => {
    let time = 86400000 - 1;
    const apiKey = crypto.randomUUID();
    const first = pool({ apiKey, now: () => time, daily: 1 });
    await first.reserve();
    const changed = pool({ apiKey, models: [models[1]!], now: () => time, daily: 1 });
    await expect(changed.reserve()).rejects.toBeInstanceOf(PoolUnavailable);
    time += 1;
    expect(await changed.reserve()).toBe(models[1]);
  });
  it("skips cooling models and respects account-wide pauses", async () => {
    let time = 100000;
    const instance = pool({ now: () => time });
    await instance.reserve();
    await instance.cooldown(models[1]!, 60);
    expect(await instance.reserve()).toBe(models[2]);
    await instance.cooldown(models[2]!, 60, true);
    await expect(instance.reserve()).rejects.toBeInstanceOf(PoolUnavailable);
    time += 60000;
    expect(await instance.reserve()).toBe(models[0]);
  });
  it("refuses per-instance quotas in production without Redis", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(pool().reserve()).rejects.toBeInstanceOf(PoolUnavailable);
  });
});
