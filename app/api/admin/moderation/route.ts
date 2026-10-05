import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ModerationStatus, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "PENDING";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Prisma.FeedPostWhereInput =
    status === "ALL"
      ? {}
      : Object.values(ModerationStatus).includes(status as ModerationStatus)
        ? { moderationStatus: status as ModerationStatus }
        : { moderationStatus: ModerationStatus.PENDING };

  const posts = await prisma.feedPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      book: { select: { title: true, author: true } },
    },
  });

  const total = await prisma.feedPost.count({ where });

  return NextResponse.json({
    posts: posts.map((post) => ({
      id: post.id,
      author: post.userName || "Leitor anônimo",
      content: post.content,
      imageUrl: post.imageUrl,
      book: post.book,
      moderationStatus: post.moderationStatus,
      moderationReason: post.moderationReason,
      moderatedBy: post.moderatedBy,
      moderatedAt: post.moderatedAt,
      createdAt: post.createdAt,
    })),
    total,
    page,
    limit,
  });
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const user = await currentUser();
  const isAdmin = user?.publicMetadata?.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json();
  const { postId, action, reason } = body;

  if (!postId || !action) {
    return NextResponse.json({ error: "postId e action são obrigatórios" }, { status: 400 });
  }

  if (!["APPROVE", "REJECT", "FLAG"].includes(action)) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const statusMap = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    FLAG: "FLAGGED",
  } as const;

  const post = await prisma.feedPost.update({
    where: { id: postId },
    data: {
      moderationStatus: statusMap[action as keyof typeof statusMap] as ModerationStatus,
      moderationReason: reason || null,
      moderatedBy: user?.fullName || user?.username || userId,
      moderatedAt: new Date(),
    },
  });

  return NextResponse.json({ post });
}
