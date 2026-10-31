import { OracleSessionError } from "@/modules/oracle";

/** Keep framework responses and sanitized logs outside the domain module. */
export function oracleHttpError(error: unknown, operation: string) {
  if (error instanceof OracleSessionError) {
    return Response.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
  }
  console.error(`[oracle] ${operation} failed`);
  return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
}
