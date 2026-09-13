import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lista os dispositivos inscritos do usuário logado.
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const devices = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ devices });
}
