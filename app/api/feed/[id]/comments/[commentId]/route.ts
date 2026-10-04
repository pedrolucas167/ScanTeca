import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, commentId } = await params;
  const comment = await prisma.feedComment.findFirst({ where: { id: commentId, postId: id }, select: { userId: true } });
  if (!comment) return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  if (comment.userId !== userId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  await prisma.feedComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
