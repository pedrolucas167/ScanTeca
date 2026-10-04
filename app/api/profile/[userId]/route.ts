import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: viewerId } = await auth();
  if (!viewerId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { userId } = await params;
  const profile = await prisma.socialProfile.findUnique({
    where: { userId },
    select: { userId: true, displayName: true, bio: true, visibility: true },
  });
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  }

  const isOwner = viewerId === userId;
  const isFollowing = await prisma.socialFollow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
    select: { id: true },
  });
  const canView = isOwner || profile.visibility === "PUBLIC" ||
    (profile.visibility === "FOLLOWERS" && Boolean(isFollowing));

  const [followers, following] = await Promise.all([
    prisma.socialFollow.count({ where: { followingId: userId } }),
    prisma.socialFollow.count({ where: { followerId: userId } }),
  ]);

  if (!canView) {
    return NextResponse.json({
      profile: {
        userId,
        displayName: profile.displayName || "Leitor",
        bio: "",
        visibility: profile.visibility,
        followers,
        following,
        isFollowing: Boolean(isFollowing),
        restricted: true,
        posts: [],
      },
    });
  }

  const posts = await prisma.feedPost.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      book: { select: { title: true, author: true, coverUrl: true } },
      _count: { select: { reactions: true, comments: true } },
      reactions: { where: { userId: viewerId }, select: { id: true } },
      bookmarks: { where: { userId: viewerId }, select: { id: true } },
    },
  });

  return NextResponse.json({
    profile: {
      userId,
      displayName: profile.displayName || "Leitor",
      bio: profile.bio || "",
      visibility: profile.visibility,
      followers,
      following,
      isFollowing: Boolean(isFollowing),
      restricted: false,
      posts: posts.map((post) => ({
        id: post.id,
        text: post.content,
        label: post.label,
        time: post.createdAt.toISOString(),
        likes: post._count.reactions,
        comments: post._count.comments,
        liked: post.reactions.length > 0,
        saved: post.bookmarks.length > 0,
        book: post.book
          ? { title: post.book.title, author: post.book.author, cover: post.book.coverUrl }
          : null,
      })),
    },
  });
}
