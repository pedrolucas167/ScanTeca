import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson, optionalNumber } from "@/lib/validation";
import { z } from "zod";

const reviewSchema = z.object({
  content: z
    .string("Conteúdo da review é obrigatório")
    .trim()
    .min(1, "Conteúdo da review é obrigatório"),
  rating: optionalNumber,
  userName: z.string().nullish(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reviews = await prisma.review.findMany({
      where: { bookId: id },
      orderBy: { createdAt: "desc" },
      include: {
        book: {
          select: { userId: true },
        },
      },
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Erro em GET reviews:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = await readJson(request, reviewSchema);
    if (!parsed.ok) return parsed.response;
    const { content, rating, userName } = parsed.data;

    const book = await prisma.book.findUnique({
      where: { id },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    const review = await prisma.review.create({
      data: {
        content,
        rating: rating ?? null,
        bookId: id,
        userId,
        userName: userName?.trim() || null,
      },
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Erro em POST reviews:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
