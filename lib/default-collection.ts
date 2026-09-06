import { prisma } from "@/lib/prisma";

export const LEGACY_DEFAULT_COLLECTION = "Minha Biblioteca";

export async function getDefaultCollection(userId: string): Promise<string> {
  const setting = await prisma.librarySetting.findUnique({
    where: { userId },
    select: { name: true },
  });
  return setting?.name ?? LEGACY_DEFAULT_COLLECTION;
}

export function resolveCollection(
  collection: unknown,
  fallback: string
): string {
  if (
    typeof collection !== "string" ||
    !collection.trim() ||
    collection === LEGACY_DEFAULT_COLLECTION
  ) {
    return fallback;
  }
  return collection.trim();
}
