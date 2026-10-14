import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { annotationSchema, createAnnotation, ReadingError } from "@/modules/reading";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });
    const parsed = await readJson(request, annotationSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await createAnnotation(userId, parsed.data));
  } catch (error) {
    if (error instanceof ReadingError) return NextResponse.json({ error: error.message }, {
      status: error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400,
    });
    console.error("[annotations] Falha na operação:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
