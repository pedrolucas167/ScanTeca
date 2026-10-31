import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OracleMode } from "@/lib/constants/oracle";

export class OracleSessionError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "DUPLICATE_REQUEST") {
    super(code === "NOT_FOUND" ? "Conversa não encontrada" : "Esta pergunta já está sendo processada.");
    this.name = "OracleSessionError";
  }
}

/** Ownership and question persistence either succeed together or roll back together. */
export async function prepareOracleSession(input: {
  userId: string;
  question: string;
  mode: OracleMode;
  sessionId?: string | null;
  requestId?: string | null;
  regenerate?: boolean;
}) {
  try {
    return await prisma.$transaction(async tx => {
      let sessionId = input.sessionId;
      if (sessionId) {
        const ownsSession = await tx.oracleSession.count({ where: { id: sessionId, userId: input.userId } });
        if (!ownsSession) throw new OracleSessionError("NOT_FOUND");
      } else {
        const session = await tx.oracleSession.create({ data: {
          userId: input.userId, title: input.question.slice(0, 80), mode: input.mode,
        } });
        sessionId = session.id;
      }
      let currentRequestMessageId: string | null = null;
      if (!input.regenerate) {
        const message = await tx.oracleMessage.create({ data: {
          userId: input.userId, sessionId, role: "user", content: input.question, requestId: input.requestId,
        } });
        currentRequestMessageId = message.id;
      }
      return { sessionId, currentRequestMessageId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new OracleSessionError("DUPLICATE_REQUEST");
    }
    throw error;
  }
}
