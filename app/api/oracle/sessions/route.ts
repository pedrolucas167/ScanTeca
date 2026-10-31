import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { listOracleSessions, createOracleSession, createOracleSessionSchema } from "@/modules/oracle";
import { oracleHttpError } from "@/lib/oracle-http-error";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const sessions = await listOracleSessions(userId);
    return Response.json({ sessions });
  } catch (error) { return oracleHttpError(error, "sessions GET"); }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const rateLimit = await rateLimitGuard(request, {
      route: "oracle/sessions",
      userId,
      userLimit: rateLimits["oracle/sessions"]?.userLimit ?? 10, ipLimit: rateLimits["oracle/sessions"]?.ipLimit ?? 20, windowMs: rateLimits["oracle/sessions"]?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, createOracleSessionSchema);
    if (!parsed.ok) return parsed.response;

    const session = await createOracleSession(userId, parsed.data);
    return Response.json({ session }, { status: 201 });
  } catch (error) { return oracleHttpError(error, "sessions POST"); }
}
