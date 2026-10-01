import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  generateEmbedding,
  bookToEmbeddingText,
  diaryToEmbeddingText,
  reviewToEmbeddingText,
} from "@/lib/embeddings";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { invalidateRecommendationsCache } from "@/lib/recommendations-cache";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "embeddings/backfill",
      userId,
      ...rateLimits["embeddings/backfill"],
    });
    if (rateLimit) return rateLimit;

    const books = await prisma.$queryRaw<
      { id: string; title: string; author: string; synopsis: string | null; genre: string | null; notes: string | null; rating: number | null }[]
    >`
      SELECT id, title, author, synopsis, genre, notes, rating
      FROM "Book"
      WHERE "userId" = ${userId} AND embedding IS NULL
    `;

    let updated = 0;
    for (const book of books) {
      const embedding = await generateEmbedding(
        bookToEmbeddingText({
          title: book.title,
          author: book.author,
          synopsis: book.synopsis,
          genre: book.genre,
          notes: book.notes,
          rating: book.rating,
        })
      );
      if (embedding) {
        const vector = `[${embedding.join(",")}]`;
        await prisma.$executeRaw`
          UPDATE "Book" SET embedding = ${vector}::vector WHERE id = ${book.id}
        `;
        updated++;
      }
    }

    const diaryEntries = await prisma.$queryRaw<{
      id: string; type: string; content: string; page: number | null;
      tags: string[]; book: { title: string; author: string };
    }[]>`
      SELECT d.id, d.type::text AS type, d.content, d.page, d.tags,
             json_build_object('title', b.title, 'author', b.author) AS book
      FROM "DiaryEntry" d
      JOIN "Book" b ON b.id = d."bookId"
      WHERE d."userId" = ${userId} AND d."ragEnabled" = true
        AND d.embedding IS NULL
    `;
    for (const entry of diaryEntries) {
      const embedding = await generateEmbedding(diaryToEmbeddingText(entry));
      if (!embedding) continue;
      await prisma.$executeRaw`
        UPDATE "DiaryEntry" SET embedding = ${`[${embedding.join(",")}]`}::vector
        WHERE id = ${entry.id}
      `;
      updated++;
    }

    const reviews = await prisma.$queryRaw<{
      id: string; content: string; rating: number | null;
      book: { title: string; author: string };
    }[]>`
      SELECT r.id, r.content, r.rating,
             json_build_object('title', b.title, 'author', b.author) AS book
      FROM "Review" r
      JOIN "Book" b ON b.id = r."bookId"
      WHERE b."userId" = ${userId} AND r.embedding IS NULL
    `;
    for (const review of reviews) {
      const embedding = await generateEmbedding(reviewToEmbeddingText(review));
      if (!embedding) continue;
      await prisma.$executeRaw`
        UPDATE "Review" SET embedding = ${`[${embedding.join(",")}]`}::vector
        WHERE id = ${review.id}
      `;
      updated++;
    }

    if (updated > 0) {
      await invalidateRecommendationsCache(userId);
    }

    return NextResponse.json({
      message: `${updated} itens indexados`,
      total: books.length + diaryEntries.length + reviews.length,
      updated,
    });
  } catch (error) {
    console.error("Erro em POST /api/embeddings/backfill:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
