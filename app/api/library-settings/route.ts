import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
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

    // Renomear a biblioteca renomeia a coleção homônima nos livros —
    // o card exibe book.collection, então sem isso o nome antigo persistia.
    // "Minha Biblioteca" é o default legado de livros criados antes do
    // nome real ser usado como coleção.
    if (
      updateData.name &&
      existing?.name &&
      existing.name !== updateData.name
    ) {
      await prisma.book.updateMany({
        where: {
          userId,
          collection: { in: [existing.name, "Minha Biblioteca"] },
        },
        data: { collection: updateData.name as string },
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
