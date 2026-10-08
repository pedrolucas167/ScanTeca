import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { deleteFeedImage } from "@/lib/s3";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const post = await prisma.feedPost.findUnique({ where: { id }, select: { userId: true, imageUrl: true } });
  if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
  if (post.userId !== userId) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  
  // Delete image from S3 if exists
  if (post.imageUrl) {
    await deleteFeedImage(post.imageUrl);
  }
  
  await prisma.feedPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
