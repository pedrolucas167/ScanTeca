import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const profileSchema = z.object({
  displayName: z.string().trim().max(80).nullable(),
  bio: z.string().trim().max(500).nullable(),
  visibility: z.enum(["PUBLIC", "FOLLOWERS", "PRIVATE"]),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const user = await currentUser();
  const profile = await prisma.socialProfile.findUnique({ where: { userId } });
  const [followers, following] = await Promise.all([
    prisma.socialFollow.count({ where: { followingId: userId } }),
    prisma.socialFollow.count({ where: { followerId: userId } }),
  ]);
  return NextResponse.json({
    profile: {
      displayName: profile?.displayName || user?.fullName || user?.firstName || user?.username || "Leitor",
      bio: profile?.bio || "",
      visibility: profile?.visibility || "PUBLIC",
      followers,
      following,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const parsed = await readJson(request, profileSchema);
  if (!parsed.ok) return parsed.response;
  const profile = await prisma.socialProfile.upsert({
    where: { userId },
    update: parsed.data,
    create: { userId, ...parsed.data },
  });
  return NextResponse.json({ profile });
}
