import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

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
    const { name } = body as { name?: string };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Nome da biblioteca é obrigatório" },
        { status: 400 }
      );
    }

    const setting = await prisma.librarySetting.upsert({
      where: { userId },
      update: { name: name.trim() },
      create: {
        userId,
        name: name.trim(),
      },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    console.error("Erro em POST /api/library-settings:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
