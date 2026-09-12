import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        customOrder: z.number().int().min(0),
      })
    )
    .min(1)
    .max(500),
});

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "books/reorder",
      userId,
      ...rateLimits["books/reorder"],
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, reorderSchema);
    if (!parsed.ok) return parsed.response;
    const { items } = parsed.data;

    // Garante que todos os livros pertencem ao usuário antes de atualizar
    const owned = await prisma.book.count({
      where: { userId, id: { in: items.map((i) => i.id) } },
    });
    if (owned !== items.length) {
      return NextResponse.json(
        { error: "Um ou mais livros não foram encontrados" },
        { status: 404 }
      );
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.book.update({
          where: { id: item.id },
          data: { customOrder: item.customOrder },
        })
      )
    );

    return NextResponse.json({ updated: items.length });
  } catch (error) {
    console.error("Erro em PATCH /api/books/reorder:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
