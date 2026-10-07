import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { moderateContent } from "@/lib/moderation";

const postSchema = z.object({
  content: z.string().trim().min(1).max(1000),
  bookId: z.string().cuid().optional(),
  label: z.string().trim().min(1).max(80).optional(),
});

function displayName(user: Awaited<ReturnType<typeof currentUser>>) {
  return user?.fullName || user?.firstName || user?.username || null;
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const viewer = await currentUser();
  const rateLimit = await rateLimitGuard(request, {
    route: "feed",
    userId,
    ...rateLimits.feed,
  });
  if (rateLimit) return rateLimit;

  const posts = await prisma.feedPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      book: { select: { title: true, author: true, coverUrl: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { id: true, userId: true, userName: true, content: true, createdAt: true },
      },
      _count: { select: { reactions: true, comments: true } },
      reactions: { where: { userId }, select: { id: true } },
      bookmarks: { where: { userId }, select: { id: true } },
    },
  });
  const authorIds = [...new Set(posts.map((post) => post.userId))];
  const [profiles, follows] = await Promise.all([
    prisma.socialProfile.findMany({
      where: { userId: { in: authorIds } },
      select: { userId: true, visibility: true },
    }),
    prisma.socialFollow.findMany({
      where: { followerId: userId, followingId: { in: authorIds } },
      select: { followingId: true },
    }),
  ]);
  const blocks = await prisma.socialBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile.visibility]));
  const followedIds = new Set(follows.map((follow) => follow.followingId));
  const blockedIds = new Set(blocks.map((block) => block.blockedId));
  const visiblePosts = posts.filter((post) => {
    if (blockedIds.has(post.userId)) return false;
    if (post.userId === userId) return true;
    // Only show approved posts from other users
    if (post.moderationStatus !== "APPROVED") return false;
    const visibility = profileByUserId.get(post.userId) || "PUBLIC";
    return visibility === "PUBLIC" || (visibility === "FOLLOWERS" && followedIds.has(post.userId));
  });

  return NextResponse.json({
    posts: visiblePosts.map((post) => ({
      id: post.id,
      authorId: post.userId,
      isOwner: post.userId === userId,
      author: post.userName || "Leitor anônimo",
      avatarUrl: post.avatarUrl || (post.userId === userId ? viewer?.imageUrl || null : null),
      initials: (post.userName || "LA").slice(0, 2).toUpperCase(),
      time: post.createdAt.toISOString(),
      label: post.label,
      text: post.content,
      imageUrl: post.imageUrl,
      book: post.book
        ? { title: post.book.title, author: post.book.author, cover: post.book.coverUrl }
        : undefined,
      likes: post._count.reactions,
      liked: post.reactions.length > 0,
      saved: post.bookmarks.length > 0,
      commentsCount: post._count.comments,
      comments: post.comments.map((comment) => ({
        id: comment.id,
        author: comment.userName || "Leitor anônimo",
        content: comment.content,
      })),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const rateLimit = await rateLimitGuard(request, {
    route: "feed",
    userId,
    ...rateLimits.feed,
  });
  if (rateLimit) return rateLimit;

  const parsed = await readJson(request, postSchema);
  if (!parsed.ok) return parsed.response;
  const user = await currentUser();

  if (parsed.data.bookId) {
    const book = await prisma.book.findFirst({
      where: { id: parsed.data.bookId, userId },
      select: { id: true },
    });
    if (!book) return NextResponse.json({ error: "Livro não encontrado" }, { status: 404 });
  }

  // Run content moderation
  const moderation = await moderateContent(parsed.data.content);
  const moderationStatus = moderation.approved ? "APPROVED" : moderation.flagged ? "FLAGGED" : "REJECTED";

  const post = await prisma.feedPost.create({
    data: {
      userId,
      userName: displayName(user),
      avatarUrl: user?.imageUrl || null,
      content: parsed.data.content,
      label: parsed.data.label || "Reflexão compartilhada",
      bookId: parsed.data.bookId,
      moderationStatus,
      moderationReason: moderation.reason,
    },
    include: { book: { select: { title: true, author: true, coverUrl: true } } },
  });

  return NextResponse.json({
    post: {
      id: post.id,
      authorId: post.userId,
      isOwner: true,
      author: post.userName || "Leitor anônimo",
      avatarUrl: post.avatarUrl,
      initials: (post.userName || "LA").slice(0, 2).toUpperCase(),
      time: post.createdAt.toISOString(),
      label: post.label,
      text: post.content,
      book: post.book
        ? { title: post.book.title, author: post.book.author, cover: post.book.coverUrl }
        : undefined,
      likes: 0,
      liked: false,
      saved: false,
      commentsCount: 0,
      comments: [],
    },
  }, { status: 201 });
}
