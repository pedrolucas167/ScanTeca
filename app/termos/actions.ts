"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { termsVersion } from "./version";

export async function acceptTerms(_previous: { error: string }, data: FormData) {
  const { userId } = await auth();
  if (!userId) return { error: "Entre na sua conta para aceitar os termos." };
  if (data.get("version") !== termsVersion || data.get("agreement") !== "accepted") {
    return { error: "Confira a versão atual dos termos e confirme seu aceite." };
  }

  try {
    await prisma.termsAcceptance.createMany({
      data: [{ userId, version: termsVersion }],
      skipDuplicates: true,
    });
  } catch {
    return { error: "Não foi possível salvar o aceite. Tente novamente." };
  }
  revalidatePath("/", "layout");
  return { error: "" };
}
