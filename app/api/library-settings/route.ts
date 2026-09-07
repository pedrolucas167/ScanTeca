import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import {
  LEGACY_DEFAULT_COLLECTION,
  resolveCollection,
} from "@/lib/default-collection";
import { z } from "zod";

const VALID_ACCENTS = ["indigo", "vinho", "floresta", "terracota"] as const;

const settingsSchema = z.object({
  name: z
    .string("Nome da biblioteca é obrigatório")
    .trim()
    .min(1, "Nome da biblioteca é obrigatório")
    .optional(),
  yearlyGoal: z
    .number("Meta anual deve ser um número inteiro positivo")
    .int("Meta anual deve ser um número inteiro positivo")
    .min(1, "Meta anual deve ser um número inteiro positivo")
    .nullish(),
  accent: z.enum(VALID_ACCENTS, "Tema de acento inválido").optional(),
  shareEnabled: z.boolean("shareEnabled deve ser booleano").optional(),
});

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    let setting = await prisma.librarySetting.findUnique({
      where: { userId },
    });

    if (!setting) {
      setting = await prisma.librarySetting.create({
        data: {
          userId,
          name: "Minha Biblioteca",
        },
      });
    }

    return NextResponse.json({ setting });
  } catch (error) {
    console.error("Erro em GET /api/library-settings:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const parsed = await readJson(request, settingsSchema);
    if (!parsed.ok) return parsed.response;
    const { name, shareEnabled, yearlyGoal, accent } = parsed.data;

    const existing = await prisma.librarySetting.findUnique({
      where: { userId },
    });

    const updateData: Record<string, unknown> = {};
    const createData: Record<string, unknown> = { userId };

    if (name !== undefined) {
      updateData.name = name;
      createData.name = name;
    }

    if (yearlyGoal !== undefined) {
      updateData.yearlyGoal = yearlyGoal;
      createData.yearlyGoal = yearlyGoal;
    }

    if (accent !== undefined) {
      updateData.accentTheme = accent;
      createData.accentTheme = accent;
    }

    if (shareEnabled !== undefined) {
      updateData.shareEnabled = shareEnabled;
      createData.shareEnabled = shareEnabled;
      if (shareEnabled && !existing?.shareId) {
        const shareId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        updateData.shareId = shareId;
        createData.shareId = shareId;
      }
    }

    const setting = await prisma.librarySetting.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        name: (createData.name as string) || "Minha Biblioteca",
        shareEnabled: (createData.shareEnabled as boolean) || false,
        shareId: (createData.shareId as string) || null,
        accentTheme: (createData.accentTheme as string) || null,
      },
    });

    if (accent !== undefined) {
      revalidateTag(`accent-theme:${userId}`, "max");
    }

    // Renomear a biblioteca reponta os livros da coleção homônima (e do
    // default legado "Minha Biblioteca") pra coleção com o nome novo.
    if (
      updateData.name &&
      existing?.name &&
      existing.name !== updateData.name
    ) {
      const target = await resolveCollection(userId, updateData.name as string);
      await prisma.book.updateMany({
        where: {
          userId,
          collection: {
            name: { in: [existing.name, LEGACY_DEFAULT_COLLECTION] },
          },
        },
        data: { collectionId: target.id },
      });
      await prisma.collection.deleteMany({
        where: {
          userId,
          name: { in: [existing.name, LEGACY_DEFAULT_COLLECTION] },
          books: { none: {} },
        },
      });
    }

    return NextResponse.json({ setting });
  } catch (error) {
    console.error("Erro em POST /api/library-settings:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
