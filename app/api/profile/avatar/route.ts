import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { uploadAvatar, deleteAvatar } from "@/lib/s3";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const avatarSchema = z.object({
  image: z.string(),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = await readJson(request, avatarSchema);
  if (!parsed.ok) return parsed.response;

  const { image } = parsed.data;

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
    // Buscar avatar atual para deletar depois
    const currentProfile = await prisma.socialProfile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });

    // Upload novo avatar
    const avatarUrl = await uploadAvatar(userId, buffer, mimeType);

    // Atualizar perfil
    const profile = await prisma.socialProfile.upsert({
      where: { userId },
      update: { avatarUrl },
      create: { userId, avatarUrl, displayName: null, bio: null, visibility: "PUBLIC" },
    });

    // Deletar avatar antigo do S3
    if (currentProfile?.avatarUrl) {
      await deleteAvatar(currentProfile.avatarUrl);
    }

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("[avatar] Upload error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload do avatar" },
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
    const profile = await prisma.socialProfile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });

    if (profile?.avatarUrl) {
      await deleteAvatar(profile.avatarUrl);
      await prisma.socialProfile.update({
        where: { userId },
        data: { avatarUrl: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[avatar] Delete error:", error);
    return NextResponse.json(
      { error: "Erro ao remover avatar" },
      { status: 500 }
    );
  }
}
