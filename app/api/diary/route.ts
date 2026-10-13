import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import {
  diaryCommandSchema, startReadingSession, pauseReadingSession,
  saveDiaryEntry, deleteDiaryEntry, ReadingError,
} from "@/modules/reading";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });
    const limit = await rateLimitGuard(request, {
      route: "diary", userId, userLimit: rateLimits.diary?.userLimit ?? 10,
      ipLimit: rateLimits.diary?.ipLimit ?? 20, windowMs: rateLimits.diary?.windowMs,
    });
    if (limit) return limit;
    const parsed = await readJson(request, diaryCommandSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    switch (input.action) {
      case "start": return Response.json({ session: await startReadingSession(userId, input.bookId) }, { status: 201 });
      case "pause": return Response.json(await pauseReadingSession(userId, input.sessionId, input.currentPage));
      case "deleteEntry": return Response.json(await deleteDiaryEntry(userId, input.entryId));
      case "entry":
      case "updateEntry": return Response.json({ entry: await saveDiaryEntry(userId, input) }, { status: input.action === "entry" ? 201 : 200 });
    }
  } catch (error) {
    if (error instanceof ReadingError) return Response.json({ error: error.message }, {
      status: error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400,
    });
    console.error("[diary] Falha na operação:", error);
    return Response.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
