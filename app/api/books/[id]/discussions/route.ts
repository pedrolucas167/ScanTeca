import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const discussionSchema = z.object({
  title: z.string().trim().min(3).max(120),
  content: z.string().trim().min(1).max(2000),
  quote: z.string().trim().max(1000).optional(),
});

async function accessibleBook(bookId: string, userId: string) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, userId: true },
  });
  if (!book) return null;
  if (book.userId === userId) return book;
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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const limit = await rateLimitGuard(request, { route: "books/discussions", userId, ...rateLimits["books/discussions"] });
  if (limit) return limit;
  const { id } = await params;
  if (!(await accessibleBook(id, userId))) return NextResponse.json({ error: "Livro não encontrado" }, { status: 404 });
  const discussions = await prisma.bookDiscussion.findMany({
    where: { bookId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { replies: { orderBy: { createdAt: "asc" }, take: 20 } },
  });
  return NextResponse.json({ discussions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const limit = await rateLimitGuard(request, { route: "books/discussions", userId, ...rateLimits["books/discussions"] });
  if (limit) return limit;
  const { id } = await params;
  if (!(await accessibleBook(id, userId))) return NextResponse.json({ error: "Livro não encontrado" }, { status: 404 });
  const parsed = await readJson(request, discussionSchema);
  if (!parsed.ok) return parsed.response;
  const user = await currentUser();
  const discussion = await prisma.bookDiscussion.create({
    data: {
      bookId: id,
      userId,
      userName: user?.fullName || user?.firstName || user?.username || null,
      ...parsed.data,
    },
    include: { replies: true },
  });
  return NextResponse.json({ discussion }, { status: 201 });
}
