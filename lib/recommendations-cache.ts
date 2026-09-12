import { getRedis } from "./redis";
import type { RecommendationsPayload } from "./recommendations";

const TTL_SECONDS = 60 * 60; // 1h
const keyFor = (userId: string) => `recs:${userId}`;

/**
 * Cache de recomendações no Redis. Todas as operações são fail-safe:
 * se o Redis falhar, retorna null/no-op e a rota segue sem cache.
 */
export async function getCachedRecommendations(
  userId: string
): Promise<RecommendationsPayload | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    return await redis.get<RecommendationsPayload>(keyFor(userId));
  } catch (err) {
    console.error("[recs-cache] Falha ao ler cache:", err);
    return null;
  }
}

export async function setCachedRecommendations(
  userId: string,
  payload: RecommendationsPayload
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(keyFor(userId), payload, { ex: TTL_SECONDS });
  } catch (err) {
    console.error("[recs-cache] Falha ao gravar cache:", err);
  }
}

/**
 * Invalida o cache quando a biblioteca ou o feedback do usuário muda
 * (livro criado/editado/removido, enrich, backfill, like/dismiss).
 */
export async function invalidateRecommendationsCache(
  userId: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(keyFor(userId));
  } catch (err) {
    console.error("[recs-cache] Falha ao invalidar cache:", err);
  }
}
