import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const artifactSchema = z.object({
  sessionId: z.string().cuid().nullable().optional(),
  type: z.enum(["CURATION", "PLAN", "DOSSIER", "MAP", "RETROSPECTIVE", "NOTE"]),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(20000),
  sources: z.array(z.object({ id: z.string(), title: z.string(), author: z.string() })).max(20).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const artifacts = await prisma.oracleArtifact.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return Response.json({ artifacts });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const rateLimit = await rateLimitGuard(request, {
    route: "oracle/artifacts",
    userId,
    ...rateLimits["oracle/artifacts"],
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, artifactSchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.sessionId) {
    const ownsSession = await prisma.oracleSession.count({
      where: { id: parsed.data.sessionId, userId },
    });
    if (!ownsSession) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const artifact = await prisma.oracleArtifact.create({
    data: { userId, ...parsed.data },
  });
  return Response.json({ artifact }, { status: 201 });
}
