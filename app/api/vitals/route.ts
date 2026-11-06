import { NextRequest } from "next/server";
import { z } from "zod";
import { analyticsCookie, analyticsPages, analyticsRatings, analyticsVitals, parseAnalyticsPreference } from "@/lib/analytics-preference";
import { getRedis } from "@/lib/redis";

const eventSchema = z.union([
  z.strictObject({ page: z.enum(analyticsPages), name: z.literal("page_view") }),
  z.strictObject({ page: z.enum(analyticsPages), name: z.enum(analyticsVitals), rating: z.enum(analyticsRatings) }),
]);

const secondsPerDay = 86_400;
const retentionDays = 30;
const countEvent = `
local count = tonumber(redis.call("HGET", KEYS[1], ARGV[1]) or "0")
if count >= 100000 then return 0 end
redis.call("HINCRBY", KEYS[1], ARGV[1], 1)
redis.call("EXPIREAT", KEYS[1], ARGV[2])
return 1
`;

export async function POST(request: NextRequest) {
  if (parseAnalyticsPreference(request.cookies.get(analyticsCookie)?.value) !== "accepted"
    || request.headers.get("origin") !== request.nextUrl.origin) {
    return new Response(null, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return new Response(null, { status: 415 });
  }

  const body = await request.text().catch(() => "");
  if (body.length > 200) return new Response(null, { status: 413 });
  const event = eventSchema.safeParse(parseEvent(body));
  if (!event.success) return new Response(null, { status: 400 });

  const redis = getRedis();
  if (!redis) return new Response(null, { status: 503 });

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const expiresAt = (Math.floor(now.getTime() / 1000 / secondsPerDay) + retentionDays) * secondsPerDay;
  const { page, name } = event.data;
  const field = name === "page_view" ? `${page}:${name}` : `${page}:${name}:${event.data.rating}`;
  try {
    const counted = await redis.eval<[string, number], number>(countEvent, [`analytics:v1:${day}`], [field, expiresAt]);
    return new Response(null, { status: counted ? 204 : 429 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

function parseEvent(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
