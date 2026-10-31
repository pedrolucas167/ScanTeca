import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** A failed new question must not turn a retry into replacement of an older answer. */
export async function getOracleRegenerationTarget(userId: string, sessionId: string) {
  const last = await prisma.oracleMessage.findFirst({ where: { userId, sessionId },
    orderBy: { createdAt: "desc" }, select: { id: true, role: true } });
  return last?.role === "assistant" ? { id: last.id } : null;
}

export async function saveOracleAnswer(input: {
  userId: string;
  sessionId: string;
  mode: string;
  content: string;
  sources: Prisma.InputJsonValue;
  replacesId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.oracleSession.updateMany({
      where: { id: input.sessionId, userId: input.userId },
      data: { mode: input.mode },
    });
    if (session.count !== 1) throw new Error("Conversa não encontrada");
    if (input.replacesId) {
      const removed = await tx.oracleMessage.deleteMany({
        where: { id: input.replacesId, userId: input.userId, sessionId: input.sessionId, role: "assistant" },
      });
      if (removed.count !== 1) throw new Error("Resposta já substituída");
    }
    return tx.oracleMessage.create({ data: {
      userId: input.userId, sessionId: input.sessionId, role: "assistant",
      content: input.content, sources: input.sources,
    } });
  });
}
