import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const discussionCreateSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório").max(200),
  content: z.string().trim().min(1, "Conteúdo é obrigatório").max(2000),
  bookId: z.string().cuid().optional(),
});

function displayName(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.fullName || user?.firstName || user?.username || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: clubId } = await params;

  const rateLimit = await rateLimitGuard(request, {
    route: "book-clubs",
    userId,
    ...rateLimits.feed,
  });
  if (rateLimit) return rateLimit;

  const club = await prisma.bookClub.findUnique({
    where: { id: clubId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!club) {
    return NextResponse.json({ error: "Clube não encontrado" }, { status: 404 });
  }

  if (!club.members[0]) {
    return NextResponse.json({ error: "Não é membro do clube" }, { status: 403 });
  }

  const parsed = await readJson(request, discussionCreateSchema);
  if (!parsed.ok) return parsed.response;

  const user = await currentUser();

  const discussion = await prisma.bookClubDiscussion.create({
    data: {
      clubId,
      userId,
      userName: displayName(user),
      title: parsed.data.title,
      content: parsed.data.content,
      bookId: parsed.data.bookId,
    },
    include: {
      replies: true,
    },
  });

  return NextResponse.json(
    {
      discussion: {
        id: discussion.id,
        title: discussion.title,
        content: discussion.content,
        bookId: discussion.bookId,
        userId: discussion.userId,
        userName: discussion.userName,
        createdAt: discussion.createdAt.toISOString(),
        replyCount: discussion.replies.length,
      },
    },
    { status: 201 }
  );
}
