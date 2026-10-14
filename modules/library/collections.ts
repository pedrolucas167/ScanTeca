import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const LEGACY_DEFAULT_COLLECTION = "Minha Biblioteca";
type CollectionDatabase = Pick<Prisma.TransactionClient, "collection" | "librarySetting">;

export async function getDefaultCollectionName(userId: string, db: CollectionDatabase = prisma) {
  const setting = await db.librarySetting.findUnique({ where: { userId }, select: { name: true } });
  return setting?.name ?? LEGACY_DEFAULT_COLLECTION;
}

export async function resolveCollection(userId: string, collection: unknown, db: CollectionDatabase = prisma) {
  const input = typeof collection === "string" ? collection.trim() : "";
  const name = !input || input === LEGACY_DEFAULT_COLLECTION ? await getDefaultCollectionName(userId, db) : input;
  return db.collection.upsert({ where: { userId_name: { userId, name } }, create: { userId, name }, update: {} });
}

export async function getDefaultCollection(userId: string) {
  return resolveCollection(userId, null);
}
