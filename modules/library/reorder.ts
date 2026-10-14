import { z } from "zod";
import { libraryTransaction } from "./transaction";
import { LibraryError } from "./errors";

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), customOrder: z.number().int().min(0) })).min(1).max(500),
}).refine(input => new Set(input.items.map(item => item.id)).size === input.items.length, "Livros duplicados na ordenação");

export async function reorderBooks(userId: string, input: z.infer<typeof reorderSchema>) {
  return libraryTransaction(async tx => {
    const ids = input.items.map(item => item.id);
    const owned = await tx.book.count({ where: { userId, id: { in: ids } } });
    if (owned !== ids.length) throw new LibraryError("NOT_FOUND", "Um ou mais livros não foram encontrados");
    for (const item of input.items) {
      await tx.book.update({ where: { id: item.id, userId }, data: { customOrder: item.customOrder } });
    }
    return { updated: ids.length };
  });
}
