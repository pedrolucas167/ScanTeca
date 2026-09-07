import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findBookCover } from "@/lib/book-cover";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const searchCoverSchema = z
  .object({
    title: z.string().nullish(),
    author: z.string().nullish(),
    isbn: z.string().nullish(),
  })
  .refine((d) => d.title || d.isbn, {
    message: "Título ou ISBN é obrigatório",
  });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const parsed = await readJson(request, searchCoverSchema);
    if (!parsed.ok) return parsed.response;
    const { title, author, isbn } = parsed.data;

    const coverUrl = await findBookCover({
      title: title ?? undefined,
      author: author ?? undefined,
      isbn: isbn ?? undefined,
    });

    if (!coverUrl) {
      return NextResponse.json(
        { error: "Nenhuma capa encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ coverUrl });
  } catch (error) {
    console.error("Erro em /api/search-cover:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
