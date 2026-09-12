import { Redis } from "@upstash/redis";

let client: Redis | null = null;
let initialized = false;

/**
 * Cliente Redis compartilhado (rate limit, cache de recomendações, etc).
 * Retorna null quando não configurado — callers devem degradar graciosamente.
 */
export function getRedis(): Redis | null {
  if (initialized) return client;
  initialized = true;

  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.KV_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "production") {
      // Em serverless cada instância tem seu próprio estado — fallbacks em
      // memória NÃO funcionam entre instâncias. Falha visível, não silenciosa.
      console.error(
        "[redis] Redis não configurado em produção. " +
          "Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN " +
          "(ou KV_REST_API_URL/KV_REST_API_TOKEN)."
      );
    }
    return null;
  }

  try {
    client = new Redis({ url, token });
    return client;
  } catch (err) {
    console.error("[redis] Falha ao criar cliente Redis:", err);
    return null;
  }
}
