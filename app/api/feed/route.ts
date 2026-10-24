import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { moderateContent } from "@/lib/moderation";
import { visibleFeedPostIds } from "@/lib/feed-access";

const postSchema = z.object({
  content: z.string().trim().min(1).max(1000),
  bookId: z.string().cuid().optional(),
  label: z.string().trim().min(1).max(80).optional(),
  quotedPostId: z.string().cuid().optional(),
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
    userLimit: rateLimits.feed?.userLimit ?? 10,
    ipLimit: rateLimits.feed?.ipLimit ?? 20,
    windowMs: rateLimits.feed?.windowMs,
  });
  if (rateLimit) return rateLimit;

  const posts = await prisma.feedPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      book: { select: { title: true, author: true, coverUrl: true } },
      quotedPost: {
        select: { id: true, userId: true, userName: true, content: true, moderationStatus: true },
      },
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
  const visibleIds = await visibleFeedPostIds(userId, posts.flatMap(post =>
    post.quotedPost ? [post, post.quotedPost] : [post]
  ));
  const visiblePosts = posts.filter(post => visibleIds.has(post.id));
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
      quotedPost: post.quotedPost && visibleIds.has(post.quotedPost.id) ? {
        id: post.quotedPost.id,
        author: post.quotedPost.userName || "Leitor anônimo",
        text: post.quotedPost.content,
      } : null,
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
    userLimit: rateLimits.feed?.userLimit ?? 10,
    ipLimit: rateLimits.feed?.ipLimit ?? 20,
    windowMs: rateLimits.feed?.windowMs,
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

  if (parsed.data.quotedPostId) {
    const quoted = await prisma.feedPost.findUnique({
      where: { id: parsed.data.quotedPostId },
      select: { id: true, userId: true, moderationStatus: true },
    });
    if (!quoted || !(await visibleFeedPostIds(userId, [quoted])).has(quoted.id)) {
      return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 });
    }
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
      quotedPostId: parsed.data.quotedPostId,
      moderationStatus,
      moderationReason: moderation.reason,
    },
    include: { 
      book: { select: { title: true, author: true, coverUrl: true } },
      quotedPost: {
        select: { id: true, userId: true, userName: true, content: true, moderationStatus: true },
      },
    },
  });

  // Revalida a citação após moderação/gravação: a visibilidade pode ter mudado.
  const visibleIds = await visibleFeedPostIds(userId, post.quotedPost ? [post.quotedPost] : []);
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
      imageUrl: post.imageUrl,
      quotedPost: post.quotedPost && visibleIds.has(post.quotedPost.id) ? {
        id: post.quotedPost.id,
        author: post.quotedPost.userName || "Leitor anônimo",
        text: post.quotedPost.content,
      } : null,
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
