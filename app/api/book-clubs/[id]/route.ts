import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { BookClubError, changeMembership, updateBookClub } from "@/modules/book-clubs";

const bookClubUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().url().optional(),
  maxMembers: z.number().int().min(1).max(1000).optional(),
  isPrivate: z.boolean().optional(),
});

const bookClubJoinSchema = z.object({
  action: z.enum(["join", "leave"]),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const club = await prisma.bookClub.findUnique({
    where: { id },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
        },
      },
      discussions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
            take: 5,
          },
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

  if (!club) {
    return NextResponse.json({ error: "Clube não encontrado" }, { status: 404 });
  }

  if (club.isPrivate && !club.members.some((m) => m.userId === userId)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const isMember = club.members.some((m) => m.userId === userId);
  const memberRole = club.members.find((m) => m.userId === userId)?.role;

  return NextResponse.json({
    club: {
      id: club.id,
      name: club.name,
      description: club.description,
      imageUrl: club.imageUrl,
      maxMembers: club.maxMembers,
      isPrivate: club.isPrivate,
      memberCount: club._count.members,
      discussionCount: club._count.discussions,
      isMember,
      isOwner: memberRole === "OWNER",
      isAdmin: memberRole === "ADMIN" || memberRole === "OWNER",
      role: memberRole,
      createdAt: club.createdAt.toISOString(),
      discussions: club.discussions.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        bookId: d.bookId,
        userId: d.userId,
        userName: d.userName,
        createdAt: d.createdAt.toISOString(),
        replyCount: d.replies.length,
        replies: d.replies.slice(0, 3).map((r) => ({
          id: r.id,
          userId: r.userId,
          userName: r.userName,
          content: r.content,
          createdAt: r.createdAt.toISOString(),
        })),
      })),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const parsed = await readJson(request, bookClubUpdateSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const club = await updateBookClub(id, userId, parsed.data);
    return NextResponse.json({ club: {
      id: club.id, name: club.name, description: club.description,
      imageUrl: club.imageUrl, maxMembers: club.maxMembers, isPrivate: club.isPrivate,
    } });
  } catch (error) {
    if (error instanceof BookClubError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const parsed = await readJson(request, bookClubJoinSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const message = await changeMembership(id, userId, parsed.data.action);
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof BookClubError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const club = await prisma.bookClub.findUnique({
    where: { id },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!club) {
    return NextResponse.json({ error: "Clube não encontrado" }, { status: 404 });
  }

  const member = club.members[0];
  if (!member || member.role !== "OWNER") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  await prisma.bookClub.delete({
    where: { id },
  });

  return NextResponse.json({ message: "Clube deletado com sucesso" });
}
