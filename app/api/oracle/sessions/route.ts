import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Nova conversa"),
  mode: z.enum(["RECOMMEND", "EXPLORE", "COMPARE", "JOURNEY", "CURATE", "LOCATE"]).default("EXPLORE"),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const sessions = await prisma.oracleSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true, artifacts: true } } },
  });
  return Response.json({ sessions });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const rateLimit = await rateLimitGuard(request, {
    route: "oracle/sessions",
    userId,
    ...rateLimits["oracle/sessions"],
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, createSessionSchema);
  if (!parsed.ok) return parsed.response;

  const session = await prisma.oracleSession.create({
    data: { userId, ...parsed.data },
  });
  return Response.json({ session }, { status: 201 });
}
