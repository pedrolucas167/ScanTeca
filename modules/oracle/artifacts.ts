import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { OracleSessionError } from "./session";

export const oracleArtifactSchema = z.object({
  sessionId: z.string().cuid().nullable().optional(),
  type: z.enum(["CURATION", "PLAN", "DOSSIER", "MAP", "RETROSPECTIVE", "NOTE"]),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(20000),
  sources: z.array(z.object({ id: z.string(), title: z.string(), author: z.string() })).max(20).optional(),
});

export function listOracleArtifacts(userId: string) {
  return prisma.oracleArtifact.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 100 });
}

export function saveOracleArtifact(userId: string, input: z.infer<typeof oracleArtifactSchema>) {
  return prisma.$transaction(async tx => {
    if (input.sessionId) {
      const owned = await tx.oracleSession.count({ where: { id: input.sessionId, userId } });
      if (!owned) throw new OracleSessionError("NOT_FOUND");
    }
    return tx.oracleArtifact.create({ data: { userId, ...input } });
  });
}
