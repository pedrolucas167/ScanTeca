import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

interface SourceEntry {
  id: string;
  title: string;
  author: string;
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Não autenticado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "rota",
      userId,
      ...rateLimits.rota,
    });
    if (rateLimit) return rateLimit;

    // 1. Oracle sources: get the last assistant message that has sources
    const lastAssistantMsg = await prisma.oracleMessage.findFirst({
      where: { userId, role: "assistant", sources: { not: Prisma.JsonNull } },
      orderBy: { createdAt: "desc" },
    });

    const requestedBookIds = (request.nextUrl.searchParams.get("books") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 8);

    let oracleBookIds: string[] = requestedBookIds;
    if (oracleBookIds.length === 0 && lastAssistantMsg?.sources) {
      // Type assertion for the sources
      const sources = lastAssistantMsg.sources as unknown as SourceEntry[];
      oracleBookIds = sources
        .map((s) => s.id)
        .filter((id): id is string => !!id);
    }

    // Fetch full book data for oracle sources
    const oracleBooks =
      oracleBookIds.length > 0
        ? await prisma.book.findMany({
            where: { id: { in: oracleBookIds }, userId },
            include: { collection: true },
          })
        : [];

    // Sort oracle books in the same order as sources
    const oracleSorted = oracleBookIds
      .map((id) => oracleBooks.find((b) => b.id === id))
      .filter(Boolean);

    // 2. Reading / To Read books
    const readingBooks = await prisma.book.findMany({
      where: { userId, status: { in: ["READING", "TO_READ"] } },
      include: { collection: true },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });

    // Map books to route steps
    const mapToStep = (book: (typeof oracleBooks)[0], index: number) => ({
      id: book.id,
      step: index + 1,
      title: book.title,
      author: book.author,
      genre: book.genre,
      pages: book.pages,
      spine: book.pages
        ? `${Math.max(0.8, Math.round(book.pages * 0.08 * 10) / 10).toFixed(1).replace(".", ",")} cm`
        : "—",
      coverUrl: book.coverUrl,
      status: book.status,
      collection: book.collection.name,
    });

    return Response.json({
      oracle: {
        steps: oracleSorted.map((b, i) => mapToStep(b!, i)),
        query:
          lastAssistantMsg
            ? (
                await prisma.oracleMessage.findFirst({
                  where: {
                    userId,
                    role: "user",
                    createdAt: { lt: lastAssistantMsg.createdAt },
                  },
                  orderBy: { createdAt: "desc" },
                })
              )?.content ?? null
            : null,
      },
      reading: {
        steps: readingBooks.map((b, i) => mapToStep(b, i)),
      },
    });
  } catch (error) {
    console.error("Erro em GET /api/rota:", error);
    return Response.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
