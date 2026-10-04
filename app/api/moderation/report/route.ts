import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const reportSchema = z.object({
  targetType: z.enum(["POST", "COMMENT", "DISCUSSION", "REPLY", "PROFILE"]),
  targetId: z.string().min(1).max(100),
  reason: z.enum(["SPAM", "HARASSMENT", "HATE", "SEXUAL", "COPYRIGHT", "OTHER"]),
  details: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const limit = await rateLimitGuard(request, {
    route: "social/moderation",
    userId,
    ...rateLimits["social/moderation"],
  });
  if (limit) return limit;
  const parsed = await readJson(request, reportSchema);
  if (!parsed.ok) return parsed.response;
  const { targetType, targetId, reason, details } = parsed.data;

  const owner = await getTargetOwner(targetType, targetId);
  if (!owner) return NextResponse.json({ error: "Conteúdo não encontrado" }, { status: 404 });
  if (owner === userId) return NextResponse.json({ error: "Você não pode denunciar o próprio conteúdo" }, { status: 400 });

  const report = await prisma.socialReport.upsert({
    where: { reporterId_targetType_targetId: { reporterId: userId, targetType, targetId } },
    create: { reporterId: userId, targetType, targetId, reason, details: details || null },
    update: { reason, details: details || null, status: "OPEN" },
    select: { id: true },
  });
  return NextResponse.json({ report }, { status: 201 });
}

async function getTargetOwner(targetType: string, targetId: string) {
  if (targetType === "POST") return (await prisma.feedPost.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId;
  if (targetType === "COMMENT") return (await prisma.feedComment.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId;
  if (targetType === "DISCUSSION") return (await prisma.bookDiscussion.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId;
  if (targetType === "REPLY") return (await prisma.bookDiscussionReply.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId;
  return (await prisma.socialProfile.findUnique({ where: { userId: targetId }, select: { userId: true } }))?.userId;
}
