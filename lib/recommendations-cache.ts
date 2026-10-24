import { randomUUID } from "node:crypto";
import { getRedis } from "./redis";
import type { RecommendationsPayload } from "./recommendations";

const TTL_SECONDS = 3600;
const VERSION_TTL_SECONDS = TTL_SECONDS * 2;
const keysFor = (userId: string) => [`recs:${userId}`, `recs:version:${userId}`];

export const READ_RECOMMENDATIONS = `
local version = redis.call('GET', KEYS[2])
if not version then
  version = ARGV[1]
  redis.call('SET', KEYS[2], version, 'EX', ARGV[2])
end
return {version, redis.call('GET', KEYS[1]) or ''}
`;
export const PUBLISH_RECOMMENDATIONS = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 1
`;
export const INVALIDATE_RECOMMENDATIONS = `
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
redis.call('DEL', KEYS[1])
return 1
`;

export interface RecommendationsSnapshot {
  payload: RecommendationsPayload | null;
  version: string | null;
}

// Cache e geração são lidos juntos: nenhuma invalidação pode ocorrer entre eles.
// Tokens aleatórios impedem ABA mesmo quando a chave de geração expira/é removida.
export async function getRecommendationsSnapshot(userId: string): Promise<RecommendationsSnapshot> {
  const redis = getRedis();
  if (redis) {
    try {
      const [version, value] = await redis.eval<[string, number], [string, RecommendationsPayload | string]>(
        READ_RECOMMENDATIONS, keysFor(userId), [randomUUID(), VERSION_TTL_SECONDS]
      );
      return { version, payload: typeof value === "string" ? value ? JSON.parse(value) : null : value };
    } catch (error) { console.error("[recs-cache] Falha ao ler cache:", error); }
  }
  return { payload: null, version: null };
}

export async function getCachedRecommendations(userId: string): Promise<RecommendationsPayload | null> {
  return (await getRecommendationsSnapshot(userId)).payload;
}

// O token deve ser obtido ANTES de buildRecommendations. Sem Redis/token, não publica.
export async function setCachedRecommendations(userId: string, payload: RecommendationsPayload, version: string | null): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !version) return false;
  try {
    return await redis.eval(PUBLISH_RECOMMENDATIONS, keysFor(userId), [version, JSON.stringify(payload), TTL_SECONDS, VERSION_TTL_SECONDS]) === 1;
  } catch (error) {
    console.error("[recs-cache] Falha ao gravar cache:", error);
    return false;
  }
}

export async function invalidateRecommendationsCache(userId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.eval(INVALIDATE_RECOMMENDATIONS, keysFor(userId), [randomUUID(), VERSION_TTL_SECONDS]);
  } catch (error) { console.error("[recs-cache] Falha ao invalidar cache:", error); }
}