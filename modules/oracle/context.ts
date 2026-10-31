import { prisma } from "@/lib/prisma";
import { isCorruptedHistoryMessage } from "@/lib/oracle-quality";
import { VECTOR_CANDIDATE_LIMIT } from "./retrieval";

interface SimilarBook {
  id: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  genre: string | null;
  status: string;
  rating: number | null;
  distance: number;
  relevance?: number;
}

interface DiaryMemory {
  id: string;
  type: string;
  content: string;
  page: number | null;
  tags: string[];
  bookTitle: string;
  bookAuthor: string;
  distance: number;
}

interface ReviewMemory {
  id: string;
  content: string;
  rating: number | null;
  bookTitle: string;
  bookAuthor: string;
  distance: number;
}

interface ExternalResearchMemory {
  id: string;
  source: string;
  title: string;
  content: string;
  type: string;
  distance: number;
}

const HISTORY_LIMIT = 8;
export const MAX_DIARY_ENTRIES = 8;
const MAX_RAG_MEMORIES = 6;

/** Load only the reader's context; omit the question that is sent separately. */
export async function loadOracleContext({ userId, sessionId, question, currentRequestMessageId, replacesId, signal }: {
  userId: string;
  sessionId: string;
  question: string;
  currentRequestMessageId: string | null;
  replacesId?: string;
  signal: AbortSignal;
}) {
  signal.throwIfAborted();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const [historyDesc, setting, readingNow, weekLogs, diaryEntries] = await Promise.all([
    prisma.oracleMessage.findMany({
      where: { userId, sessionId, ...(replacesId ? { id: { not: replacesId } } : {}) },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
    prisma.librarySetting.findUnique({ where: { userId } }),
    prisma.book.findMany({
      where: { userId, status: "READING" },
      select: {
        title: true,
        author: true,
        currentPage: true,
        pages: true,
        startedAt: true,
      },
    }),
    prisma.readingLog.findMany({
      where: { userId, date: { gte: weekAgo } },
      select: { date: true, pages: true },
    }),
    prisma.diaryEntry.findMany({
      where: { userId, ragEnabled: true, book: { userId } },
      orderBy: { createdAt: "desc" },
      take: MAX_DIARY_ENTRIES,
      select: {
        type: true,
        content: true,
        page: true,
        id: true,
        book: { select: { title: true, author: true } },
      },
    }),
  ]);
  signal.throwIfAborted();

  // The current question is already persisted above. It is sent separately
  // in the final prompt and must not be duplicated in the conversation.
  const conversationHistory = historyDesc.filter((message, index) => {
    if (message.role === "assistant" && isCorruptedHistoryMessage(message.content)) {
      return false;
    }
    if (currentRequestMessageId) return message.id !== currentRequestMessageId;
    return !(index === 0 && message.role === "user" && message.content === question);
  });

  return { conversationHistory, setting, readingNow, weekLogs, diaryEntries };
}

/** Bound vectors stay parameterized; no embedding means no vector queries. */
export async function retrieveOracleMemories(userId: string, embedding: number[] | null, signal: AbortSignal) {
  signal.throwIfAborted();
  const vector = `[${embedding?.join(",") ?? ""}]`;
  const [similarBooks, semanticDiary, semanticReviews, semanticExternal] = await Promise.all([
    embedding ? prisma.$queryRaw<SimilarBook[]>`
    SELECT id, title, author, "publishedDate", synopsis, genre,
           status::text as status, rating,
           embedding <=> ${vector}::vector AS distance
    FROM "Book"
    WHERE "userId" = ${userId} AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vector}::vector
    LIMIT ${VECTOR_CANDIDATE_LIMIT}
    ` : Promise.resolve([] as SimilarBook[]),
    embedding ? prisma.$queryRaw<DiaryMemory[]>`
      SELECT d.id, d.type, d.content, d.page, d.tags,
             b.title AS "bookTitle", b.author AS "bookAuthor",
             d.embedding <=> ${vector}::vector AS distance
      FROM "DiaryEntry" d
      JOIN "Book" b ON b.id = d."bookId"
      WHERE d."userId" = ${userId} AND b."userId" = ${userId}
        AND d."ragEnabled" = true
        AND d.embedding IS NOT NULL
      ORDER BY d.embedding <=> ${vector}::vector
      LIMIT ${MAX_RAG_MEMORIES}
    ` : Promise.resolve([] as DiaryMemory[]),
    embedding ? prisma.$queryRaw<ReviewMemory[]>`
      SELECT r.id, r.content, r.rating,
             b.title AS "bookTitle", b.author AS "bookAuthor",
             r.embedding <=> ${vector}::vector AS distance
      FROM "Review" r
      JOIN "Book" b ON b.id = r."bookId"
      WHERE b."userId" = ${userId} AND r."userId" = ${userId}
        AND r.embedding IS NOT NULL
      ORDER BY r.embedding <=> ${vector}::vector
      LIMIT ${MAX_RAG_MEMORIES}
    ` : Promise.resolve([] as ReviewMemory[]),
    embedding ? prisma.$queryRaw<ExternalResearchMemory[]>`
      SELECT id, source, title, content, type,
             embedding <=> ${vector}::vector AS distance
      FROM "ExternalResearchData"
      WHERE "userId" = ${userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${MAX_RAG_MEMORIES}
    ` : Promise.resolve([] as ExternalResearchMemory[]),
  ]);
  signal.throwIfAborted();

  return { similarBooks, semanticDiary, semanticReviews, semanticExternal };
}
