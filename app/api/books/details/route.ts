import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCatalogDetails } from "@/modules/library";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const limit = await rateLimitGuard(request, {
    route: "books/details", userId,
    userLimit: rateLimits.books?.userLimit ?? 10,
    ipLimit: rateLimits.books?.ipLimit ?? 20,
    windowMs: rateLimits.books?.windowMs,
  });
  if (limit) return limit;
  const id = request.nextUrl.searchParams.get("id");
  if (id !== null && (!id.trim() || id.length > 200)) {
    return NextResponse.json({ error: "ID do livro inválido" }, { status: 400 });
  }
  try {
    const books = await getCatalogDetails(userId, id ?? undefined);
    if (id && !books.length) return NextResponse.json({ error: "Livro não encontrado" }, { status: 404 });
    return NextResponse.json({ books }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Erro ao carregar detalhes do catálogo:", error);
    return NextResponse.json({ error: "Erro ao carregar os livros" }, { status: 500 });
  }
}
