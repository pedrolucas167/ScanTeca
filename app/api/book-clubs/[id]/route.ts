import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

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
  request: NextRequest,
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
  if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = await readJson(request, bookClubUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.imageUrl !== undefined) data.imageUrl = parsed.data.imageUrl;
  if (parsed.data.maxMembers !== undefined) data.maxMembers = parsed.data.maxMembers;
  if (parsed.data.isPrivate !== undefined) data.isPrivate = parsed.data.isPrivate;

  const updatedClub = await prisma.bookClub.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    club: {
      id: updatedClub.id,
      name: updatedClub.name,
      description: updatedClub.description,
      imageUrl: updatedClub.imageUrl,
      maxMembers: updatedClub.maxMembers,
      isPrivate: updatedClub.isPrivate,
    },
  });
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

  const club = await prisma.bookClub.findUnique({
    where: { id },
    include: {
      members: true,
    },
  });

  if (!club) {
    return NextResponse.json({ error: "Clube não encontrado" }, { status: 404 });
  }

  if (parsed.data.action === "join") {
    if (club.members.some((m) => m.userId === userId)) {
      return NextResponse.json({ error: "Já é membro" }, { status: 400 });
    }

    if (club.maxMembers && club.members.length >= club.maxMembers) {
      return NextResponse.json({ error: "Clube cheio" }, { status: 400 });
    }

    if (club.isPrivate) {
      return NextResponse.json({ error: "Clube privado - requer convite" }, { status: 403 });
    }

    await prisma.bookClubMember.create({
      data: {
        clubId: id,
        userId,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ message: "Entrou no clube com sucesso" });
  }

  if (parsed.data.action === "leave") {
    const member = club.members.find((m) => m.userId === userId);
    if (!member) {
      return NextResponse.json({ error: "Não é membro" }, { status: 400 });
    }

    if (member.role === "OWNER") {
      return NextResponse.json({ error: "Dono não pode sair" }, { status: 400 });
    }

    await prisma.bookClubMember.delete({
      where: {
        clubId_userId: {
          clubId: id,
          userId,
        },
      },
    });

    return NextResponse.json({ message: "Saiu do clube com sucesso" });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}

export async function DELETE(
  request: NextRequest,
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
