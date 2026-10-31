import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OracleMode } from "@/lib/constants/oracle";
import { z } from "zod";

const sessionMode = z.enum(["RECOMMEND", "EXPLORE", "COMPARE", "JOURNEY", "CURATE", "LOCATE"]);
export const createOracleSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Nova conversa"),
  mode: sessionMode.default("EXPLORE"),
});
export const updateOracleSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(), mode: sessionMode.optional(),
});

export function listOracleSessions(userId: string) {
  return prisma.oracleSession.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 50,
    include: { _count: { select: { messages: { where: { userId } }, artifacts: { where: { userId } } } } } });
}

export function createOracleSession(userId: string, input: z.infer<typeof createOracleSessionSchema>) {
  return prisma.oracleSession.create({ data: { userId, ...input } });
}

export function findOracleSession(userId: string, id: string) {
  return prisma.oracleSession.findFirst({ where: { id, userId }, include: {
    messages: { where: { userId }, orderBy: { createdAt: "asc" } },
    artifacts: { where: { userId }, orderBy: { updatedAt: "desc" } },
  } });
}

export async function updateOracleSession(userId: string, id: string, input: z.infer<typeof updateOracleSessionSchema>) {
  return (await prisma.oracleSession.updateMany({ where: { id, userId }, data: input })).count === 1;
}

export async function deleteOracleSession(userId: string, id: string) {
  return (await prisma.oracleSession.deleteMany({ where: { id, userId } })).count === 1;
}

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
