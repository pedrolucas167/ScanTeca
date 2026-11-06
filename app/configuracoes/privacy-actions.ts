"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function saveCity(_previous: string, form: FormData) {
  const { userId } = await auth();
  if (!userId) return "Entre na sua conta para salvar a cidade.";
  const input = form.get("city");
  if (typeof input !== "string") return "Informe uma cidade válida.";
  const city = input.trim().normalize("NFC");
  if (city.length > 100 || (city && !/^[\p{L}\p{M}\p{N} .’'()–-]+$/u.test(city))) {
    return "Informe somente o nome da cidade, com até 100 caracteres.";
  }
  try {
    if (city) {
      await prisma.privacyPreference.upsert({ where: { userId }, create: { userId, city }, update: { city } });
    } else {
      await prisma.privacyPreference.deleteMany({ where: { userId } });
    }
    return city ? "Cidade salva." : "Cidade removida.";
  } catch {
    return "Não foi possível salvar a preferência. Tente novamente.";
  }
}
