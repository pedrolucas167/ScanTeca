import { prisma } from "@/lib/prisma";

export const LEGACY_DEFAULT_COLLECTION = "Minha Biblioteca";

async function getOrCreateCollection(userId: string, name: string) {
  return prisma.collection.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name },
    update: {},
  });
}

// A coleção default é a que tem o nome da biblioteca (LibrarySetting.name).
export async function getDefaultCollection(userId: string) {
  const setting = await prisma.librarySetting.findUnique({
    where: { userId },
    select: { name: true },
  });
  return getOrCreateCollection(
    userId,
    setting?.name ?? LEGACY_DEFAULT_COLLECTION
  );
}

// Formulários mandam o nome da coleção. Vazio ou o default legado
// ("Minha Biblioteca", de antes do nome real ser usado) caem na default.
export async function resolveCollection(userId: string, collection: unknown) {
  const name = typeof collection === "string" ? collection.trim() : "";
  if (!name || name === LEGACY_DEFAULT_COLLECTION) {
    return getDefaultCollection(userId);
  }
  return getOrCreateCollection(userId, name);
}
