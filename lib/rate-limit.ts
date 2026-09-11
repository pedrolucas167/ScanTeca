import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  userLimit: number;
  ipLimit: number;
  windowMs?: number;
}

export const rateLimits: Record<string, RateLimitConfig> = {
  oracle: { userLimit: 15, ipLimit: 60, windowMs: 60_000 },
  "oracle/tts": { userLimit: 20, ipLimit: 60, windowMs: 60_000 },
  scan: { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  "search-books": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "search-cover": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "search-cover-wikipedia": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "search-author": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "generate-synopsis": { userLimit: 20, ipLimit: 60, windowMs: 60_000 },
};

interface RateLimitOutcome {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

interface RateLimitStore {
  check(key: string, windowMs: number, maxRequests: number): Promise<RateLimitOutcome>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly map = new Map<string, { count: number; reset: number }>();

  async check(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitOutcome> {
    const now = Date.now();
    const record = this.map.get(key);

    if (!record || record.reset <= now) {
      const reset = now + windowMs;
      this.map.set(key, { count: 1, reset });
      return {
        success: true,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - 1),
        reset,
      };
    }

    record.count++;
    const success = record.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - record.count);
    return {
      success,
      limit: maxRequests,
      remaining,
      reset: record.reset,
      retryAfter: success ? undefined : Math.ceil((record.reset - now) / 1000),
    };
  }
}

class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async check(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitOutcome> {
    const redisKey = `rate:${key}`;
    const [count, ttl] = await Promise.all([
      this.redis.incr(redisKey),
      this.redis.pttl(redisKey),
    ]);

    if (ttl < 0) {
      await this.redis.pexpire(redisKey, windowMs);
    }

    const now = Date.now();
    const ttlMs = ttl >= 0 ? ttl : windowMs;
    const reset = now + ttlMs;
    const success = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);

    return {
      success,
      limit: maxRequests,
      remaining,
      reset,
      retryAfter: success ? undefined : Math.ceil(ttlMs / 1000),
    };
  }
}

let globalStore: RateLimitStore | null = null;
let storeInitialized = false;

function getStore(): RateLimitStore {
  if (storeInitialized) {
    return globalStore ?? new MemoryRateLimitStore();
  }

  const redis = createRedisClient();
  globalStore = redis ? new RedisRateLimitStore(redis) : new MemoryRateLimitStore();
  storeInitialized = true;
  return globalStore;
}

function createRedisClient(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.KV_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch (err) {
    console.error("[rate-limit] Falha ao criar cliente Redis:", err);
    return null;
  }
}

function getClientIP(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  const real = request.headers.get("x-real-ip");
  if (real) return real;

  // Next.js expõe o IP em alguns ambientes (Node/Vercel).
  // @ts-expect-error — ip pode existir em NextRequest em runtime Node.
  if (typeof request.ip === "string") return request.ip;

  return "unknown";
}

function rateLimitResponse(outcome: RateLimitOutcome): NextResponse {
  const retryAfter = String(outcome.retryAfter ?? Math.max(1, Math.ceil((outcome.reset - Date.now()) / 1000)));
  return NextResponse.json(
    { error: "Muitas requisições. Tente novamente em breve." },
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter,
        "X-RateLimit-Limit": String(outcome.limit),
        "X-RateLimit-Remaining": String(outcome.remaining),
        "X-RateLimit-Reset": String(outcome.reset),
      },
    }
  );
}

export async function rateLimitGuard(
  request: NextRequest,
  options: {
    route: string;
    userId?: string | null;
    userLimit: number;
    ipLimit: number;
    windowMs?: number;
  }
): Promise<NextResponse | null> {
  const windowMs = options.windowMs ?? 60_000;
  const store = getStore();
  const ip = getClientIP(request);

  const ipCheck = await store.check(
    `ip:${ip}:${options.route}`,
    windowMs,
    options.ipLimit
  );
  if (!ipCheck.success) {
    return rateLimitResponse(ipCheck);
  }

  if (options.userId) {
    const userCheck = await store.check(
      `user:${options.userId}:${options.route}`,
      windowMs,
      options.userLimit
    );
    if (!userCheck.success) {
      return rateLimitResponse(userCheck);
    }
  }

  return null;
}
