import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const rateLimit = await rateLimitGuard(request, {
    route: "social/discover",
    userId,
    ...rateLimits["social/discover"],
  });
  if (rateLimit) return rateLimit;

  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  const profiles = await prisma.socialProfile.findMany({
    where: {
      userId: { not: userId },
      visibility: { not: "PRIVATE" },
      ...(query
        ? {
            OR: [
              { displayName: { contains: query, mode: "insensitive" } },
              { bio: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      userId: true,
      displayName: true,
      bio: true,
      visibility: true,
    },
  });

  const follows = await prisma.socialFollow.findMany({
    where: {
      followerId: userId,
      followingId: { in: profiles.map((profile) => profile.userId) },
    },
    select: { followingId: true },
  });
  const followingIds = new Set(follows.map((follow) => follow.followingId));

  const [followerCounts, followingCounts] = await Promise.all([
    prisma.socialFollow.groupBy({
      by: ["followingId"],
      where: { followingId: { in: profiles.map((profile) => profile.userId) } },
      _count: { _all: true },
    }),
    prisma.socialFollow.groupBy({
      by: ["followerId"],
      where: { followerId: { in: profiles.map((profile) => profile.userId) } },
      _count: { _all: true },
    }),
  ]);
  const followersByUserId = new Map(followerCounts.map((item) => [item.followingId, item._count._all]));
  const followingByUserId = new Map(followingCounts.map((item) => [item.followerId, item._count._all]));

  return NextResponse.json({
    readers: profiles.map((profile) => ({
      userId: profile.userId,
      displayName: profile.displayName || "Leitor",
      bio: profile.bio || "",
      visibility: profile.visibility,
      followers: followersByUserId.get(profile.userId) || 0,
      following: followingByUserId.get(profile.userId) || 0,
      isFollowing: followingIds.has(profile.userId),
    })),
  });
}
