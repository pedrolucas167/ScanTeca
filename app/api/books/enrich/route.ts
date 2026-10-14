import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { libraryHttpError } from "@/lib/library-http-error";
import { enrichSchema, enrichBooks } from "@/modules/library";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const limits = rateLimits["books/enrich"];
    const limited = await rateLimitGuard(request, {
      route: "books/enrich", userId,
      userLimit: limits?.userLimit ?? 10, ipLimit: limits?.ipLimit ?? 20, windowMs: limits?.windowMs,
    });
    if (limited) return limited;
    const parsed = await readJson(request, enrichSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await enrichBooks(userId, parsed.data.bookId));
  } catch (error) { return libraryHttpError(error, "books/enrich"); }
}
