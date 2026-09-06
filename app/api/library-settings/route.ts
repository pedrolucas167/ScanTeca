import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const VALID_ACCENTS = ["indigo", "vinho", "floresta", "terracota"];

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

    const body = await request.json();
    const { name, shareEnabled, yearlyGoal, accent } = body as {
      name?: string;
      shareEnabled?: boolean;
      yearlyGoal?: number | null;
      accent?: string;
    };

    const existing = await prisma.librarySetting.findUnique({
      where: { userId },
    });

    const updateData: Record<string, unknown> = {};
    const createData: Record<string, unknown> = { userId };

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Nome da biblioteca é obrigatório" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
      createData.name = name.trim();
    }

    if (yearlyGoal !== undefined) {
      if (yearlyGoal !== null && (!Number.isInteger(yearlyGoal) || yearlyGoal < 1)) {
        return NextResponse.json(
          { error: "Meta anual deve ser um número inteiro positivo" },
          { status: 400 }
        );
      }
      updateData.yearlyGoal = yearlyGoal;
      createData.yearlyGoal = yearlyGoal;
    }

    if (accent !== undefined) {
      if (!VALID_ACCENTS.includes(accent)) {
        return NextResponse.json(
          { error: "Tema de acento inválido" },
          { status: 400 }
        );
      }
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
    // o card exibe book.collection, então sem isso o nome antigo persistia
    if (
      updateData.name &&
      existing?.name &&
      existing.name !== updateData.name
    ) {
      await prisma.book.updateMany({
        where: { userId, collection: existing.name },
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
