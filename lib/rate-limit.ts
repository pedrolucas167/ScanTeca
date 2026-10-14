import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getRedis } from "./redis";

export interface RateLimitConfig {
  userLimit: number;
  ipLimit: number;
  windowMs?: number;
}

export const rateLimits: Record<string, RateLimitConfig> = {
  oracle: { userLimit: 15, ipLimit: 60, windowMs: 60_000 },
  "oracle/tts": { userLimit: 20, ipLimit: 60, windowMs: 60_000 },
  "oracle/sessions": { userLimit: 60, ipLimit: 120, windowMs: 60_000 },
  "oracle/artifacts": { userLimit: 60, ipLimit: 120, windowMs: 60_000 },
  scan: { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  "search-books": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "search-cover": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "search-cover-wikipedia": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "search-author": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "generate-synopsis": { userLimit: 20, ipLimit: 60, windowMs: 60_000 },
  books: { userLimit: 60, ipLimit: 180, windowMs: 60_000 },
  "books/reorder": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  "books/reviews": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "books/discussions": { userLimit: 40, ipLimit: 120, windowMs: 60_000 },
  feed: { userLimit: 60, ipLimit: 180, windowMs: 60_000 },
  "social/discover": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  "social/moderation": { userLimit: 30, ipLimit: 90, windowMs: 60_000 },
  // Chamadas externas por livro (Google Books + OpenRouter) — bem restrito.
  "books/enrich": { userLimit: 5, ipLimit: 15, windowMs: 60_000 },
  "embeddings/backfill": { userLimit: 5, ipLimit: 15, windowMs: 60_000 },
  diary: { userLimit: 60, ipLimit: 120, windowMs: 60_000 },
  "library-settings": { userLimit: 30, ipLimit: 60, windowMs: 60_000 },
  "push/subscribe": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  "push/devices": { userLimit: 30, ipLimit: 60, windowMs: 60_000 },
  "push/preferences": { userLimit: 30, ipLimit: 60, windowMs: 60_000 },
  "admin/broadcast": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  // LLM + embeddings por request — caro.
  recommendations: { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  rota: { userLimit: 30, ipLimit: 60, windowMs: 60_000 },
  "rag-audit": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  // Anônimo (web-vitals): só o ipLimit é aplicado.
  vitals: { userLimit: 120, ipLimit: 120, windowMs: 60_000 },
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

// INCR + PEXPIRE num único script Lua: atômico. Sem isso, duas requests
// concorrentes podiam incrementar antes do expire e a chave ficava sem TTL.
const RATE_LIMIT_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return {count, redis.call("PTTL", KEYS[1])}
`;

class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async check(
    key: string,
    windowMs: number,
    maxRequests: number
  ): Promise<RateLimitOutcome> {
    const redisKey = `rate:${key}`;
    const [count, ttl] = await this.redis.eval<[number], [number, number]>(
      RATE_LIMIT_LUA,
      [redisKey],
      [windowMs]
    );

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

  const redis = getRedis();
  globalStore = redis ? new RedisRateLimitStore(redis) : new MemoryRateLimitStore();
  storeInitialized = true;
  return globalStore;
}

function getClientIP(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    if (parts[0]) {
      const first = parts[0].trim();
      if (first) return first;
    }
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

// Domain-based rate limiting for web scraping
export interface DomainRateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  burstAllowance?: number;
}

export const domainRateLimits: Record<string, DomainRateLimitConfig> = {
  wikipedia: { requestsPerSecond: 1, requestsPerMinute: 60, burstAllowance: 5 },
  goodreads: { requestsPerSecond: 0.5, requestsPerMinute: 30, burstAllowance: 3 },
  google_books: { requestsPerSecond: 0.3, requestsPerMinute: 20, burstAllowance: 2 },
  default: { requestsPerSecond: 0.5, requestsPerMinute: 30, burstAllowance: 3 },
};

export async function checkDomainRateLimit(
  domain: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const store = getStore();
  const config = domainRateLimits[domain] ?? domainRateLimits.default;
  const now = Date.now();

  // Check per-second limit
  const secondKey = `domain:${domain}:sec:${Math.floor(now / 1000)}`;
  const secondCheck = await store.check(secondKey, 1000, config?.requestsPerSecond ?? 0.5);
  if (!secondCheck.success) {
    return { allowed: false, retryAfter: secondCheck.retryAfter };
  }

  // Check per-minute limit
  const minuteKey = `domain:${domain}:min:${Math.floor(now / 60000)}`;
  const minuteCheck = await store.check(minuteKey, 60000, config?.requestsPerMinute ?? 30);
  if (!minuteCheck.success) {
    return { allowed: false, retryAfter: minuteCheck.retryAfter };
  }

  return { allowed: true };
}

// Extract domain from URL for rate limiting
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Remove www. prefix
    return hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
