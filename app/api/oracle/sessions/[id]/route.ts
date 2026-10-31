import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { findOracleSession, updateOracleSession, deleteOracleSession, updateOracleSessionSchema } from "@/modules/oracle";
import { oracleHttpError } from "@/lib/oracle-http-error";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });
    const { id } = await context.params;

    const session = await findOracleSession(userId, id);
    if (!session) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
    return Response.json({ session });
  } catch (error) { return oracleHttpError(error, "session GET"); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const rateLimit = await rateLimitGuard(request, {
      route: "oracle/sessions",
      userId,
      userLimit: rateLimits["oracle/sessions"]?.userLimit ?? 10,
      ipLimit: rateLimits["oracle/sessions"]?.ipLimit ?? 20,
      windowMs: rateLimits["oracle/sessions"]?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const { id } = await context.params;
    const parsed = await readJson(request, updateOracleSessionSchema);
    if (!parsed.ok) return parsed.response;

    const updated = await updateOracleSession(userId, id, parsed.data);
    if (!updated) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return oracleHttpError(error, "session PATCH"); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const rateLimit = await rateLimitGuard(request, {
      route: "oracle/sessions",
      userId,
      userLimit: rateLimits["oracle/sessions"]?.userLimit ?? 10,
      ipLimit: rateLimits["oracle/sessions"]?.ipLimit ?? 20,
      windowMs: rateLimits["oracle/sessions"]?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const { id } = await context.params;

    const removed = await deleteOracleSession(userId, id);
    if (!removed) return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) { return oracleHttpError(error, "session DELETE"); }
}
