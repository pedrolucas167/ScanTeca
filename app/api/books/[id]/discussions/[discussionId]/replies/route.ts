import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";
import { createSocialNotification } from "@/lib/social-notifications";

const replySchema = z.object({
  content: z.string().trim().min(1).max(2000),
  quote: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; discussionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const limit = await rateLimitGuard(request, { route: "books/discussions", userId, ...rateLimits["books/discussions"] });
  if (limit) return limit;
  const { id, discussionId } = await params;
  const discussion = await prisma.bookDiscussion.findFirst({ where: { id: discussionId, bookId: id }, select: { id: true, userId: true } });
  if (!discussion) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  const parsed = await readJson(request, replySchema);
  if (!parsed.ok) return parsed.response;
  const user = await currentUser();
  const reply = await prisma.bookDiscussionReply.create({
    data: {
      discussionId,
      userId,
      userName: user?.fullName || user?.firstName || user?.username || null,
      ...parsed.data,
    },
  });
  void createSocialNotification({
    recipientId: discussion.userId,
    actorId: userId,
    actorName: user?.fullName || user?.firstName || user?.username || "Alguém",
    type: "DISCUSSION_REPLY",
    message: `${user?.fullName || user?.firstName || user?.username || "Alguém"} respondeu à sua conversa sobre livro. 📚`,
    url: `/books/${id}`,
  }).catch(() => {});
  return NextResponse.json({ reply }, { status: 201 });
}
