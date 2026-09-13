import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson, optionalNumber } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { sendPush } from "@/lib/push";
import { z } from "zod";

const reviewSchema = z.object({
  content: z
    .string("Conteúdo da review é obrigatório")
    .trim()
    .min(1, "Conteúdo da review é obrigatório"),
  rating: optionalNumber,
});

// Reviews são públicas quando a biblioteca do dono está compartilhada.
// Retorna o livro se o acesso é permitido, null caso contrário.
async function findAccessibleBook(bookId: string, userId: string | null) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, userId: true, title: true },
  });
  if (!book) return null;

  if (userId === book.userId) return book;

  const shared = await prisma.librarySetting.findFirst({
    where: { userId: book.userId, shareEnabled: true },
    select: { id: true },
  });
  return shared ? book : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    const rateLimit = await rateLimitGuard(request, {
      route: "books/reviews",
      userId,
      ...rateLimits["books/reviews"],
    });
    if (rateLimit) return rateLimit;

    const { id } = await params;

    const book = await findAccessibleBook(id, userId);

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
    const { content, rating } = parsed.data;

    const book = await findAccessibleBook(id, userId);

    if (!book) {
      return NextResponse.json(
        { error: "Livro não encontrado" },
        { status: 404 }
      );
    }

    // Nome vem do Clerk server-side — não confia em valor enviado pelo cliente.
    const user = await currentUser();
    const displayName =
      user?.fullName || user?.firstName || user?.username || null;

    const review = await prisma.review.create({
      data: {
        content,
        rating: rating ?? null,
        bookId: id,
        userId,
        userName: displayName,
      },
    });

    // Push pro dono da biblioteca quando outro usuário comenta.
    // Fire-and-forget: falha de push não pode quebrar o POST da review.
    if (book.userId !== userId) {
      sendPush(
        {
          title: "Nova review na sua estante",
          body: `${displayName || "Alguém"} comentou em "${book.title}"`,
          url: `/books/${id}`,
        },
        { userId: book.userId, category: "reviews" }
      ).catch(() => {});
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error("Erro em POST reviews:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
