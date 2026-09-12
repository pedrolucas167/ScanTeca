import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson, optionalNumber } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "books/reviews",
      userId,
      ...rateLimits["books/reviews"],
    });
    if (rateLimit) return rateLimit;

    const { id } = await params;

    const book = await prisma.book.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!book) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    const reviews = await prisma.review.findMany({
      where: { bookId: id },
      orderBy: { createdAt: "desc" },
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

    const rateLimit = await rateLimitGuard(request, {
      route: "books/reviews",
      userId,
      ...rateLimits["books/reviews"],
    });
    if (rateLimit) return rateLimit;

    const { id } = await params;
    const parsed = await readJson(request, reviewSchema);
    if (!parsed.ok) return parsed.response;
    const { content, rating, userName } = parsed.data;

    const book = await prisma.book.findFirst({
      where: { id, userId },
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
