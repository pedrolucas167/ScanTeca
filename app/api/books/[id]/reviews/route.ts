import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

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
    const body = await request.json();
    const { content, rating, userName } = body as {
      content?: string;
      rating?: number;
      userName?: string;
    };

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Conteúdo da review é obrigatório" },
        { status: 400 }
      );
    }

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
        content: content.trim(),
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
