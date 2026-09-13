import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Remove uma inscrição do usuário logado (revoga o dispositivo).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.pushSubscription.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Dispositivo não encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
