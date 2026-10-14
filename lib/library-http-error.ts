import { NextResponse } from "next/server";
import { LibraryError } from "@/modules/library";

export function libraryHttpError(error: unknown, operation: string) {
  if (error instanceof LibraryError) return NextResponse.json({ error: error.message }, {
    status: error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400,
  });
  console.error(`[library] ${operation}:`, error);
  return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
}
