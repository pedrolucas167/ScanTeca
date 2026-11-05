import { afterAll, describe, expect, it } from "vitest";
import { createModelPool, PoolUnavailable } from "@/lib/openrouter-pool";
import { localRedis } from "./redis-client";

const { client, command } = localRedis();
const namespaces: string[] = [];
const models = ["fixture/alpha:free", "fixture/beta:free", "fixture/gamma:free"];
function pool(daily = 50) {
  const instance = createModelPool({ apiKey: crypto.randomUUID(), models, redis: client, daily });
  namespaces.push(instance.namespace);
  return instance;
}
afterAll(async () => {
  for (const namespace of namespaces) {
    const keys = await command("KEYS", `${namespace}:*`) as string[];
    if (keys.length) await command("DEL", ...keys);
  }
});
describe("atomic free pool on disposable Redis", () => {
  it("coordinates concurrent callers fairly and never reserves more than the minute cap", async () => {
    const instance = pool();
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => instance.reserve()));
    const selected = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    expect(selected).toHaveLength(20);
    expect(models.map(model => selected.filter(item => item === model).length)).toEqual([7, 7, 6]);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(10);
  });
  it("counts failed reservations against the daily budget and shares it across instances", async () => {
    const apiKey = crypto.randomUUID();
    const first = createModelPool({ apiKey, models, redis: client, daily: 2 });
    namespaces.push(first.namespace);
    const second = createModelPool({ apiKey, models: models.slice(1), redis: client, daily: 2 });
    await first.reserve(); await second.reserve();
    await expect(first.reserve()).rejects.toBeInstanceOf(PoolUnavailable);
    await expect(second.reserve()).rejects.toBeInstanceOf(PoolUnavailable);
  });
  it("skips cooling models and persists a shared account pause", async () => {
    const instance = pool();
    await instance.reserve();
    await instance.cooldown(models[1]!, 60);
    expect(await instance.reserve()).toBe(models[2]);
    await instance.cooldown(models[2]!, 60, true);
    await expect(instance.reserve()).rejects.toBeInstanceOf(PoolUnavailable);
  });
});
