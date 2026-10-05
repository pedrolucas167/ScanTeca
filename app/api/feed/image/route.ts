import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { uploadFeedImage, deleteFeedImage } from "@/lib/s3";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const imageSchema = z.object({
  image: z.string(),
  postId: z.string(),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = await readJson(request, imageSchema);
  if (!parsed.ok) return parsed.response;

  const { image, postId } = parsed.data;

  // Validar tamanho do arquivo (base64)
  const base64Data = image.split(",")[1];
  const buffer = Buffer.from(base64Data, "base64");
  
  if (buffer.length > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Imagem muito grande. Máximo 5MB." },
      { status: 400 }
    );
  }

  // Validar tipo MIME
  const mimeType = image.split(";")[0].split(":")[1];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Formato não suportado. Use JPEG, PNG ou WebP." },
      { status: 400 }
    );
  }

  try {
    // Verificar se o post pertence ao usuário
    const post = await prisma.feedPost.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json(
        { error: "Post não encontrado ou não autorizado" },
        { status: 404 }
      );
    }

    // Buscar imagem atual para deletar depois
    const currentPost = await prisma.feedPost.findUnique({
      where: { id: postId },
      select: { imageUrl: true },
    });

    // Upload nova imagem
    const imageUrl = await uploadFeedImage(userId, postId, buffer, mimeType);

    // Atualizar post
    const updatedPost = await prisma.feedPost.update({
      where: { id: postId },
      data: { imageUrl },
    });

    // Deletar imagem antiga do S3
    if (currentPost?.imageUrl) {
      await deleteFeedImage(currentPost.imageUrl);
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("[feed-image] Upload error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "postId é obrigatório" }, { status: 400 });
    }

    const post = await prisma.feedPost.findUnique({
      where: { id: postId },
      select: { userId: true, imageUrl: true },
    });

    if (!post || post.userId !== userId) {
      return NextResponse.json(
        { error: "Post não encontrado ou não autorizado" },
        { status: 404 }
      );
    }

    if (post.imageUrl) {
      await deleteFeedImage(post.imageUrl);
      await prisma.feedPost.update({
        where: { id: postId },
        data: { imageUrl: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[feed-image] Delete error:", error);
    return NextResponse.json(
      { error: "Erro ao remover imagem" },
      { status: 500 }
    );
  }
}
