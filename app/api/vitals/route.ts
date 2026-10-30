import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const metricSchema = z.object({
  id: z.string().max(200),
  name: z.string().max(50),
  value: z.number().finite().nonnegative(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  path: z.string().max(300),
  lcp: z.object({
    element: z.enum(["IMG", "H1", "H2", "P", "DIV", "SPAN", "OTHER"]),
    paintMs: z.number().finite().nonnegative(),
    resourceStartMs: z.number().finite().nonnegative().optional(),
    resourceEndMs: z.number().finite().nonnegative().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  // Rota anônima: limita só por IP para evitar flood de métricas falsas.
  const rateLimit = await rateLimitGuard(request, {
    route: "vitals",
    userLimit: rateLimits.vitals?.userLimit ?? 10,
    ipLimit: rateLimits.vitals?.ipLimit ?? 20,
    windowMs: rateLimits.vitals?.windowMs,
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, metricSchema);
  if (!parsed.ok) return parsed.response;
  console.info("web-vital", parsed.data);
  return new Response(null, { status: 204 });
}
