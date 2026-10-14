import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { libraryHttpError } from "@/lib/library-http-error";
import { getLibrarySettings, updateLibrarySettings, settingsSchema } from "@/modules/library";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    return NextResponse.json({ setting: await getLibrarySettings(userId) });
  } catch (error) { return libraryHttpError(error, "settings GET"); }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const limits = rateLimits["library-settings"];
    const limited = await rateLimitGuard(request, {
      route: "library-settings", userId, userLimit: limits?.userLimit ?? 10,
      ipLimit: limits?.ipLimit ?? 20, windowMs: limits?.windowMs,
    });
    if (limited) return limited;
    const parsed = await readJson(request, settingsSchema);
    if (!parsed.ok) return parsed.response;
    const setting = await updateLibrarySettings(userId, parsed.data);
    if (parsed.data.accent !== undefined) revalidateTag(`accent-theme:${userId}`, "max");
    return NextResponse.json({ setting });
  } catch (error) { return libraryHttpError(error, "settings POST"); }
}
