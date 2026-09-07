import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findWikipediaCover } from "@/lib/book-cover";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const wikiCoverSchema = z.object({
  title: z.string("Título é obrigatório").min(1, "Título é obrigatório"),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const parsed = await readJson(request, wikiCoverSchema);
    if (!parsed.ok) return parsed.response;
    const { title } = parsed.data;

    const coverUrl = await findWikipediaCover(title);

    if (!coverUrl) {
      return NextResponse.json(
        { error: "Nenhuma capa encontrada na Wikipédia" },
        { status: 404 }
      );
    }

    return NextResponse.json({ coverUrl });
  } catch (error) {
    console.error("Erro em /api/search-cover-wikipedia:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
