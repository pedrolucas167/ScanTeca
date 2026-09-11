import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface SourceEntry {
  id: string;
}

export interface RouteStep {
  id: string;
  step: number;
  title: string;
  author: string;
  genre: string | null;
  pages: number | null;
  spine: string;
  coverUrl: string | null;
  status: string;
  collection: string;
}

export interface RouteData {
  oracle: { steps: RouteStep[]; query: string | null };
  reading: { steps: RouteStep[] };
}

export async function getRouteData(userId: string, requestedIds: string[]): Promise<RouteData> {
  const lastAssistantMsg = await prisma.oracleMessage.findFirst({
    where: { userId, role: "assistant", sources: { not: Prisma.JsonNull } },
    orderBy: { createdAt: "desc" },
    select: { sources: true, createdAt: true },
  });

  let oracleBookIds = requestedIds;
  if (oracleBookIds.length === 0 && lastAssistantMsg?.sources) {
    oracleBookIds = (lastAssistantMsg.sources as unknown as SourceEntry[])
      .map((source) => source.id)
      .filter(Boolean)
      .slice(0, 8);
  }

  const [oracleBooks, readingBooks, previousQuestion] = await Promise.all([
    oracleBookIds.length
      ? prisma.book.findMany({
          where: { id: { in: oracleBookIds }, userId },
          select: { id: true, title: true, author: true, genre: true, pages: true, coverUrl: true, status: true, collection: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.book.findMany({
      where: { userId, status: { in: ["READING", "TO_READ"] } },
      select: { id: true, title: true, author: true, genre: true, pages: true, coverUrl: true, status: true, collection: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    lastAssistantMsg
      ? prisma.oracleMessage.findFirst({
          where: { userId, role: "user", createdAt: { lt: lastAssistantMsg.createdAt } },
          orderBy: { createdAt: "desc" },
          select: { content: true },
        })
      : Promise.resolve(null),
  ]);

  const mapToStep = (book: (typeof readingBooks)[number], index: number): RouteStep => ({
    id: book.id,
    step: index + 1,
    title: book.title,
    author: book.author,
    genre: book.genre,
    pages: book.pages,
    spine: book.pages ? `${Math.max(0.8, Math.round(book.pages * 0.08 * 10) / 10).toFixed(1).replace(".", ",")} cm` : "—",
    coverUrl: book.coverUrl,
    status: book.status,
    collection: book.collection.name,
  });

  const oracleById = new Map(oracleBooks.map((book) => [book.id, book]));
  const oracleSorted = oracleBookIds.flatMap((id) => {
    const book = oracleById.get(id);
    return book ? [book] : [];
  });

  return {
    oracle: { steps: oracleSorted.map(mapToStep), query: previousQuestion?.content ?? null },
    reading: { steps: readingBooks.map(mapToStep) },
  };
}
