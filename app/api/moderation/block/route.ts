import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const schema = z.object({ userId: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const limit = await rateLimitGuard(request, { route: "social/moderation", userId, ...rateLimits["social/moderation"] });
  if (limit) return limit;
  const parsed = await readJson(request, schema);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.userId === userId) return NextResponse.json({ error: "Leitor inválido" }, { status: 400 });
  const existing = await prisma.socialBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: parsed.data.userId } },
  });
  if (existing) {
    await prisma.socialBlock.delete({ where: { id: existing.id } });
  } else {
    await prisma.socialBlock.create({ data: { blockerId: userId, blockedId: parsed.data.userId } });
    await prisma.socialFollow.deleteMany({
      where: {
        OR: [
          { followerId: userId, followingId: parsed.data.userId },
          { followerId: parsed.data.userId, followingId: userId },
        ],
      },
    });
  }
  return NextResponse.json({ blocked: !existing });
}
