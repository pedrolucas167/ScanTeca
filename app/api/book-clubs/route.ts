import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const bookClubCreateSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional(),
  maxMembers: z.number().int().min(1).max(1000).optional(),
  isPrivate: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const rateLimit = await rateLimitGuard(request, {
    route: "book-clubs",
    userId,
    ...rateLimits.feed,
  });
  if (rateLimit) return rateLimit;

  const { searchParams } = new URL(request.url);
  const includeMyClubs = searchParams.get("my") === "true";

  const clubs = await prisma.bookClub.findMany({
    where: includeMyClubs
      ? {
          members: {
            some: { userId },
          },
        }
      : {
          isPrivate: false,
        },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
        },
      },
      _count: {
        select: {
          members: true,
          discussions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    clubs: clubs.map((club) => ({
      id: club.id,
      name: club.name,
      description: club.description,
      imageUrl: club.imageUrl,
      maxMembers: club.maxMembers,
      isPrivate: club.isPrivate,
      memberCount: club._count.members,
      discussionCount: club._count.discussions,
      isMember: club.members.some((m) => m.userId === userId),
      isOwner: club.members.some((m) => m.userId === userId && m.role === "OWNER"),
      createdAt: club.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const rateLimit = await rateLimitGuard(request, {
    route: "book-clubs",
    userId,
    ...rateLimits.feed,
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, bookClubCreateSchema);
  if (!parsed.ok) return parsed.response;

  const club = await prisma.bookClub.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      imageUrl: parsed.data.imageUrl || null,
      maxMembers: parsed.data.maxMembers || null,
      isPrivate: parsed.data.isPrivate || false,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
        },
      },
      _count: {
        select: {
          members: true,
          discussions: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      club: {
        id: club.id,
        name: club.name,
        description: club.description,
        imageUrl: club.imageUrl,
        maxMembers: club.maxMembers,
        isPrivate: club.isPrivate,
        memberCount: club._count.members,
        discussionCount: club._count.discussions,
        isMember: true,
        isOwner: true,
        createdAt: club.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
