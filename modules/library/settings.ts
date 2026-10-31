import { z } from "zod";
import { yearlyGoalSchema } from "@/modules/reading/client";
import { libraryTransaction } from "./transaction";
import { LEGACY_DEFAULT_COLLECTION, resolveCollection } from "./collections";
import { LibraryError } from "./errors";

export const settingsSchema = z.object({
  name: z.string("Nome da biblioteca é obrigatório").trim().min(1, "Nome da biblioteca é obrigatório").optional(),
  yearlyGoal: yearlyGoalSchema,
  accent: z.enum(["indigo", "vinho", "floresta", "terracota"], "Tema de acento inválido").optional(),
  shareEnabled: z.boolean("shareEnabled deve ser booleano").optional(),
  oracleProfile: z.string().trim().max(2000, "Memória muito longa").nullable().optional(),
  oracleMemoryEnabled: z.boolean().optional(),
  oracleProfileVersion: z.number().int().nonnegative().optional(),
});

export async function updateLibrarySettings(userId: string, input: z.infer<typeof settingsSchema>) {
  return libraryTransaction(async tx => {
    const existing = await tx.librarySetting.findUnique({ where: { userId } });
    const memoryChange = input.oracleProfile !== undefined || input.oracleMemoryEnabled !== undefined;
    if (memoryChange && input.oracleProfileVersion !== undefined && input.oracleProfileVersion !== (existing?.oracleProfileVersion ?? 0)) {
      throw new LibraryError("CONFLICT", "A memória mudou em outra conversa. Recarregue antes de salvar.");
    }
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.yearlyGoal !== undefined ? { yearlyGoal: input.yearlyGoal } : {}),
      ...(input.accent !== undefined ? { accentTheme: input.accent } : {}),
      ...(input.oracleProfile !== undefined ? { oracleProfile: input.oracleProfile || null } : {}),
      ...(input.oracleMemoryEnabled !== undefined ? { oracleMemoryEnabled: input.oracleMemoryEnabled }
        : input.oracleProfile !== undefined && !input.oracleProfile ? { oracleMemoryEnabled: false } : {}),
      ...(input.shareEnabled !== undefined ? { shareEnabled: input.shareEnabled } : {}),
      ...(input.shareEnabled && !existing?.shareId ? { shareId: crypto.randomUUID().replace(/-/g, "").slice(0, 16) } : {}),
    };
    const setting = await tx.librarySetting.upsert({ where: { userId },
      update: { ...data, ...(memoryChange ? { oracleProfileVersion: { increment: 1 } } : {}) },
      create: { ...data, userId, name: input.name || "Minha Biblioteca", oracleProfileVersion: memoryChange ? 1 : 0 },
    });
    if (input.name && existing?.name && existing.name !== input.name) {
      const target = await resolveCollection(userId, input.name, tx);
      const names = [existing.name, LEGACY_DEFAULT_COLLECTION];
      await tx.book.updateMany({ where: { userId, collection: { name: { in: names } } }, data: { collectionId: target.id } });
      await tx.collection.deleteMany({ where: { userId, name: { in: names }, books: { none: {} } } });
    }
    return setting;
  });
}
