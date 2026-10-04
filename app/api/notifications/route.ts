import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const notifications = await prisma.socialNotification.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  await prisma.socialNotification.updateMany({
    where: {
      recipientId: userId,
      ...(body.id ? { id: body.id } : { readAt: null }),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
