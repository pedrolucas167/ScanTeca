import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { findSynopsis } from "@/lib/synopsis";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const synopsisSchema = z.object({
  title: z.string("Título é obrigatório").trim().min(1, "Título é obrigatório"),
  author: z.string().nullish(),
  isbn: z.string().nullish(),
  currentSynopsis: z.string().nullish(),
  force: z.boolean().nullish(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const parsed = await readJson(request, synopsisSchema);
    if (!parsed.ok) return parsed.response;
    const { title, author, isbn, currentSynopsis, force } = parsed.data;

    const trimmedCurrent = currentSynopsis?.trim();

    if (!force && trimmedCurrent) {
      return NextResponse.json({ synopsis: trimmedCurrent });
    }

    const synopsis = await findSynopsis({
      title,
      author: author?.trim() || undefined,
      isbn: isbn?.trim() || undefined,
    });

    return NextResponse.json({ synopsis });
  } catch (error) {
    console.error("Erro em POST /api/generate-synopsis:", error);
    return NextResponse.json(
      { error: "Erro ao gerar sinopse" },
      { status: 500 }
    );
  }
}
