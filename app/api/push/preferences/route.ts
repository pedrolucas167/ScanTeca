import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";

const prefsSchema = z.object({
  reviews: z.boolean().optional(),
  updates: z.boolean().optional(),
  progress: z.boolean().optional(),
});

// Preferências de notificação do usuário. Ausência de linha = tudo ligado.
export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  return NextResponse.json({
    preferences: {
      reviews: prefs?.reviews ?? true,
      updates: prefs?.updates ?? true,
      progress: prefs?.progress ?? true,
    },
  });
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = await readJson(request, prefsSchema);
  if (!parsed.ok) return parsed.response;

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    update: parsed.data,
    create: {
      userId,
      reviews: parsed.data.reviews ?? true,
      updates: parsed.data.updates ?? true,
      progress: parsed.data.progress ?? true,
    },
  });

  return NextResponse.json({
    preferences: {
      reviews: prefs.reviews,
      updates: prefs.updates,
      progress: prefs.progress,
    },
  });
}
