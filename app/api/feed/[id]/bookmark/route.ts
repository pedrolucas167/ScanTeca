import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.feedBookmark.findUnique({
    where: { postId_userId: { postId: id, userId } },
  });
  if (existing) {
    await prisma.feedBookmark.delete({ where: { id: existing.id } });
  } else {
    await prisma.feedBookmark.create({ data: { postId: id, userId } });
  }
  return NextResponse.json({ saved: !existing });
}
