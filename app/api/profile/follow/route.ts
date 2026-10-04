import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { createSocialNotification } from "@/lib/social-notifications";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = (await request.json()) as { followingId?: string };
  if (!body.followingId || body.followingId === userId) {
    return NextResponse.json({ error: "Leitor inválido" }, { status: 400 });
  }
  const existing = await prisma.socialFollow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: body.followingId } },
  });
  if (existing) {
    await prisma.socialFollow.delete({ where: { id: existing.id } });
  } else {
    await prisma.socialFollow.create({
      data: { followerId: userId, followingId: body.followingId },
    });
    const user = await currentUser();
    void createSocialNotification({
      recipientId: body.followingId,
      actorId: userId,
      actorName: user?.fullName || user?.firstName || user?.username || "Alguém",
      type: "FOLLOW",
      message: `${user?.fullName || user?.firstName || user?.username || "Alguém"} começou a seguir você. 👋`,
      url: `/perfil/${userId}`,
    }).catch(() => {});
  }
  return NextResponse.json({ following: !existing });
}
