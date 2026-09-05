import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

interface AuditRow {
  id: string;
  title: string;
  author: string;
  hasEmbedding: boolean;
  hasSynopsis: boolean;
}

/**
 * GET /api/rag-audit
 * Diagnóstico do RAG: lista os livros do usuário logado indicando
 * quais têm embedding nulo e quais têm sinopse vazia/nula —
 * as duas causas mais comuns de "livros fantasmas" no Oráculo.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const books = await prisma.$queryRaw<AuditRow[]>`
      SELECT id, title, author,
             (embedding IS NOT NULL) AS "hasEmbedding",
             (synopsis IS NOT NULL AND btrim(synopsis) <> '') AS "hasSynopsis"
      FROM "Book"
      WHERE "userId" = ${userId}
      ORDER BY title
    `;

    const missingEmbedding = books.filter((b) => !b.hasEmbedding);
    const missingSynopsis = books.filter((b) => !b.hasSynopsis);

    return NextResponse.json({
      total: books.length,
      missingEmbedding: missingEmbedding.length,
      missingSynopsis: missingSynopsis.length,
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        hasEmbedding: b.hasEmbedding,
        hasSynopsis: b.hasSynopsis,
      })),
      // Livros problemáticos: sem embedding (invisíveis ao Oráculo)
      // ou sem sinopse (embedding fraco, caem no ranking vetorial)
      ghosts: books
        .filter((b) => !b.hasEmbedding || !b.hasSynopsis)
        .map((b) => ({
          id: b.id,
          title: b.title,
          reason: !b.hasEmbedding
            ? "sem embedding — rode POST /api/embeddings/backfill"
            : "sem sinopse — embedding fraco, edite o livro e adicione uma sinopse",
        })),
    });
  } catch (error) {
    console.error("Erro em GET /api/rag-audit:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
