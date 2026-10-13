import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import type { NextResponse as HttpResponse } from "next/server";
import {
  bookCreateSchema, bookUpdateSchema, createBook, updateBook, deleteBook, LibraryError,
} from "@/modules/library";

function handleError(error: unknown, operation: string) {
  if (error instanceof LibraryError) {
    return NextResponse.json({ error: error.message }, {
      status: error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400,
    });
  }
  console.error(`Erro em ${operation} /api/books:`, error);
  return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
}

async function authorize(request: NextRequest): Promise<
  { response: HttpResponse; userId?: never } | { userId: string; response?: never }
> {
  const { userId } = await auth();
  if (!userId) return { response: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const response = await rateLimitGuard(request, {
    route: "books", userId,
    userLimit: rateLimits.books?.userLimit ?? 10,
    ipLimit: rateLimits.books?.ipLimit ?? 20,
    windowMs: rateLimits.books?.windowMs,
  });
  return response ? { response } : { userId };
}

export async function POST(request: NextRequest) {
  try {
    const access = await authorize(request);
    if (access.response) return access.response;
    const parsed = await readJson(request, bookCreateSchema);
    if (!parsed.ok) return parsed.response;
    const { created, ...body } = await createBook(access.userId, parsed.data);
    return NextResponse.json(body, { status: created ? 201 : 200 });
  } catch (error) { return handleError(error, "POST"); }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await authorize(request);
    if (access.response) return access.response;
    const parsed = await readJson(request, bookUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const body = await updateBook(access.userId, parsed.data);
    return NextResponse.json(body);
  } catch (error) { return handleError(error, "PATCH"); }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await authorize(request);
    if (access.response) return access.response;
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID do livro é obrigatório" }, { status: 400 });
    const body = await deleteBook(access.userId, id);
    return NextResponse.json(body);
  } catch (error) { return handleError(error, "DELETE"); }
}
