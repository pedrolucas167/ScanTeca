import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { createSocialNotification } from "@/lib/social-notifications";

const commentSchema = z.object({ content: z.string().trim().min(1).max(1000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const parsed = await readJson(request, commentSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  const post = await prisma.feedPost.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  const user = await currentUser();
  const comment = await prisma.feedComment.create({
    data: {
      postId: id,
      userId,
      userName: user?.fullName || user?.firstName || user?.username || null,
      content: parsed.data.content,
    },
  });
  void createSocialNotification({
    recipientId: post.userId,
    actorId: userId,
    actorName: user?.fullName || user?.firstName || user?.username || "Alguém",
    type: "COMMENT",
    message: `${user?.fullName || user?.firstName || user?.username || "Alguém"} comentou na sua publicação. 💬`,
    url: `/feed#${id}`,
  }).catch(() => {});
  return NextResponse.json({
    comment: {
      id: comment.id,
      author: comment.userName || "Leitor anônimo",
      content: comment.content,
    },
  }, { status: 201 });
}
