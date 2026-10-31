import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { listOracleArtifacts, saveOracleArtifact, oracleArtifactSchema } from "@/modules/oracle";
import { oracleHttpError } from "@/lib/oracle-http-error";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const artifacts = await listOracleArtifacts(userId);
    return Response.json({ artifacts });
  } catch (error) { return oracleHttpError(error, "artifacts GET"); }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });

    const rateLimit = await rateLimitGuard(request, {
      route: "oracle/artifacts",
      userId,
      userLimit: rateLimits["oracle/artifacts"]?.userLimit ?? 10, ipLimit: rateLimits["oracle/artifacts"]?.ipLimit ?? 20, windowMs: rateLimits["oracle/artifacts"]?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const parsed = await readJson(request, oracleArtifactSchema);
    if (!parsed.ok) return parsed.response;

    const artifact = await saveOracleArtifact(userId, parsed.data);
    return Response.json({ artifact }, { status: 201 });
  } catch (error) { return oracleHttpError(error, "artifacts POST"); }
}
