import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, bookToEmbeddingText } from "@/lib/embeddings";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

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

    return NextResponse.json({
      message: `${updated} de ${books.length} livros indexados`,
      total: books.length,
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
