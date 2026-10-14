import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { libraryHttpError } from "@/lib/library-http-error";
import { scanSchema, scanBook } from "@/modules/library";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const limits = rateLimits["scan"];
    const limited = await rateLimitGuard(request, {
      route: "scan", userId,
      userLimit: limits?.userLimit ?? 10, ipLimit: limits?.ipLimit ?? 20, windowMs: limits?.windowMs,
    });
    if (limited) return limited;
    const parsed = await readJson(request, scanSchema);
    if (!parsed.ok) return parsed.response;
    const { body, created } = await scanBook(userId, parsed.data);
    return NextResponse.json(body, { status: created ? 201 : 200 });
  } catch (error) { return libraryHttpError(error, "scan"); }
}
