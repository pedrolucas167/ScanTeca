import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const metricSchema = z.object({
  id: z.string().max(200),
  name: z.enum(["CLS", "FCP", "INP", "LCP", "TTFB"]),
  value: z.number().finite().nonnegative(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  path: z.string().startsWith("/").max(300),
});

export async function POST(request: NextRequest) {
  // Rota anônima: limita só por IP para evitar flood de métricas falsas.
  const rateLimit = await rateLimitGuard(request, {
    route: "vitals",
    ...rateLimits.vitals,
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, metricSchema);
  if (!parsed.ok) return parsed.response;
  console.info("web-vital", parsed.data);
  return new Response(null, { status: 204 });
}
