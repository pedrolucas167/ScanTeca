import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";

const updateSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(["RECOMMEND", "EXPLORE", "COMPARE", "JOURNEY", "CURATE", "LOCATE"]).optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await context.params;

  const session = await prisma.oracleSession.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!session) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  return Response.json({ session });
}

export async function PATCH(request: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await context.params;
  const parsed = await readJson(request, updateSessionSchema);
  if (!parsed.ok) return parsed.response;

  const result = await prisma.oracleSession.updateMany({
    where: { id, userId },
    data: parsed.data,
  });
  if (result.count === 0) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await context.params;

  const result = await prisma.oracleSession.deleteMany({ where: { id, userId } });
  if (result.count === 0) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
  return Response.json({ ok: true });
}
