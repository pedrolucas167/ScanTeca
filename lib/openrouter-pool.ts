import { createHash, randomUUID } from "node:crypto";
import type { Redis } from "@upstash/redis";

// Provisional development candidate, not a production quality approval.
// Other candidates are added explicitly for a benchmark, never silently enabled.
export const DEFAULT_FREE_MODELS = ["nvidia/nemotron-3.5-super-vl:free"];
// Public catalog checked 2026-11-04: these candidates permit disabling reasoning.
// Mandatory-reasoning models are deliberately absent from this set.
export const FREE_MODELS_WITH_OPTIONAL_REASONING = new Set(["google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3.5-lightning:free", ...DEFAULT_FREE_MODELS]);

export function parseFreeModels(value: string) {
  const models = [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))];
  if (!models.length || models.length > 8 || models.some(model => !/^[a-z0-9._-]+\/[a-z0-9._:-]+:free$/i.test(model))) {
    throw new Error("Configure between one and eight explicit :free model IDs.");
  }
  return models;
}

// A single reservation rotates the pool and accounts for every attempted call.
// Redis TIME and atomic Lua coordinate all serverless instances using this key.
const RESERVE = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local day = math.floor(now / 86400000)
local daily = KEYS[1] .. ':day:' .. day
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 60000)
if tonumber(redis.call('GET', daily) or '0') >= tonumber(ARGV[2]) then return {-1, math.ceil(((day+1)*86400000-now)/1000)} end
local pause = tonumber(redis.call('GET', KEYS[1] .. ':pause') or '0')
if pause > now then return {-1, math.ceil((pause-now)/1000)} end
if redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[1]) then
  local first = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  return {-1, math.max(1, math.ceil((tonumber(first[2])+60000-now)/1000))}
end
local count = tonumber(ARGV[3])
local cursor = tonumber(redis.call('GET', KEYS[1]) or '0')
for offset=0,count-1 do
  local index = (cursor+offset) % count
  local cooldown = tonumber(redis.call('GET', KEYS[3+index]) or '0')
  if cooldown <= now then
    redis.call('SET', KEYS[1], (index+1) % count, 'EX', 172800)
    redis.call('INCR', daily)
    redis.call('EXPIRE', daily, 172800)
    redis.call('ZADD', KEYS[2], now, ARGV[4])
    redis.call('PEXPIRE', KEYS[2], 60000)
    return {index,0}
  end
end
return {-1,30}
`;

export class PoolUnavailable extends Error {
  constructor(public readonly retryAfter: number) { super("Free model pool temporarily unavailable"); }
}

type State = { cursor: number; times: number[]; day: number; count: number; cooldowns: Map<string, number>; pause: number };
const localStates = new Map<string, State>();

export function createModelPool({ apiKey, models, redis, rpm = 20, daily = 50, now = Date.now }: {
  apiKey: string; models: string[]; redis: Redis | null; rpm?: number; daily?: number; now?: () => number;
}) {
  const prefix = `oracle:free:${createHash("sha256").update(apiKey).digest("hex").slice(0, 24)}`;
  const cooldownKey = (model: string) => `${prefix}:cooldown:${model}`;
  // Quotas are shared by credential, independently of pool membership/order.
  const globalKey = `${prefix}:cursor`;
  return {
    async reserve() {
      if (redis) {
        const [index, retry] = await redis.eval<(string | number)[], [number, number]>(RESERVE,
          [globalKey, `${prefix}:minute`, ...models.map(cooldownKey)], [rpm, daily, models.length, randomUUID()]);
        if (index < 0 || !models[index]) throw new PoolUnavailable(retry || 30);
        return models[index]!;
      }
      if (process.env.NODE_ENV === "production") throw new PoolUnavailable(30);
      const time = now();
      const day = Math.floor(time / 86400000);
      let state = localStates.get(globalKey);
      if (!state) { state = { cursor: 0, times: [], day, count: 0, cooldowns: new Map(), pause: 0 }; localStates.set(globalKey, state); }
      if (state.day !== day) { state.day = day; state.count = 0; }
      state.times = state.times.filter(value => value > time - 60000);
      if (state.count >= daily) throw new PoolUnavailable(Math.ceil(((day + 1) * 86400000 - time) / 1000));
      if (state.pause > time) throw new PoolUnavailable(Math.ceil((state.pause - time) / 1000));
      if (state.times.length >= rpm) throw new PoolUnavailable(Math.max(1, Math.ceil((state.times[0]! + 60000 - time) / 1000)));
      for (let offset = 0; offset < models.length; offset++) {
        const index = (state.cursor + offset) % models.length;
        const model = models[index]!;
        if ((state.cooldowns.get(model) || 0) > time) continue;
        state.cursor = (index + 1) % models.length;
        state.times.push(time); state.count++;
        return model;
      }
      throw new PoolUnavailable(30);
    },
    async cooldown(model: string, seconds: number, global = false) {
      const duration = Math.max(1, Math.min(86400, Math.ceil(seconds)));
      if (redis) {
        // Redis TIME prevents instance clock drift; never shorten an existing pause.
        await redis.eval(`local t=redis.call('TIME'); local untilAt=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)+tonumber(ARGV[1])*1000; local old=tonumber(redis.call('GET',KEYS[1]) or '0'); if untilAt>old then redis.call('SET',KEYS[1],untilAt,'EX',ARGV[1]) end; return 1`,
          [global ? `${globalKey}:pause` : cooldownKey(model)], [duration]);
      } else {
        const state = localStates.get(globalKey);
        if (state) {
          if (global) state.pause = Math.max(state.pause, now() + duration * 1000);
          else state.cooldowns.set(model, Math.max(state.cooldowns.get(model) || 0, now() + duration * 1000));
        }
      }
    },
    // Non-secret identifier for integration-test cleanup; no API key is stored.
    namespace: prefix,
  };
}
