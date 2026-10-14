import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { libraryHttpError } from "@/lib/library-http-error";
import { reorderSchema, reorderBooks } from "@/modules/library";

export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const limits = rateLimits["books/reorder"];
    const limited = await rateLimitGuard(request, {
      route: "books/reorder", userId,
      userLimit: limits?.userLimit ?? 10, ipLimit: limits?.ipLimit ?? 20, windowMs: limits?.windowMs,
    });
    if (limited) return limited;
    const parsed = await readJson(request, reorderSchema);
    if (!parsed.ok) return parsed.response;
    return NextResponse.json(await reorderBooks(userId, parsed.data));
  } catch (error) { return libraryHttpError(error, "books/reorder"); }
}
