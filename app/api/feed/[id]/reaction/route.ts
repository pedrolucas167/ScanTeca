import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { createSocialNotification } from "@/lib/social-notifications";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const post = await prisma.feedPost.findUnique({ where: { id }, select: { userId: true } });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  const existing = await prisma.feedReaction.findUnique({
    where: { postId_userId: { postId: id, userId } },
  });
  if (existing) {
    await prisma.feedReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.feedReaction.create({ data: { postId: id, userId } });
    const user = await currentUser();
    void createSocialNotification({
      recipientId: post.userId,
      actorId: userId,
      actorName: user?.fullName || user?.firstName || user?.username || "Alguém",
      type: "REACTION",
      message: `${user?.fullName || user?.firstName || user?.username || "Alguém"} curtiu sua publicação. ❤️`,
      url: `/feed#${id}`,
    }).catch(() => {});
  }
  return NextResponse.json({ liked: !existing });
}
