import { prisma } from "@/lib/prisma";

interface FeedAccessPost {
  id: string;
  userId: string;
  moderationStatus: string;
}

// Inclua autores das citações: acesso ao post principal não concede acesso ao citado.
export async function visibleFeedPostIds(viewerId: string, posts: FeedAccessPost[]): Promise<Set<string>> {
  if (!posts.length) return new Set();
  const authorIds = [...new Set(posts.map(post => post.userId))];
  const [profiles, follows, blocks] = await Promise.all([
    prisma.socialProfile.findMany({ where: { userId: { in: authorIds } }, select: { userId: true, visibility: true } }),
    prisma.socialFollow.findMany({ where: { followerId: viewerId, followingId: { in: authorIds } }, select: { followingId: true } }),
    prisma.socialBlock.findMany({ where: { blockerId: viewerId, blockedId: { in: authorIds } }, select: { blockedId: true } }),
  ]);
  const visibility = new Map(profiles.map(profile => [profile.userId, profile.visibility]));
  const followed = new Set(follows.map(follow => follow.followingId));
  const blocked = new Set(blocks.map(block => block.blockedId));
  return new Set(posts.filter(post => {
    if (blocked.has(post.userId)) return false;
    if (post.userId === viewerId) return true;
    if (post.moderationStatus !== "APPROVED") return false;
    const mode = visibility.get(post.userId) ?? "PUBLIC";
    return mode === "PUBLIC" || (mode === "FOLLOWERS" && followed.has(post.userId));
  }).map(post => post.id));
}
