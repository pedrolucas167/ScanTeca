import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const schema = z.object({ audio: z.object({
  data: z.string().min(1).max(14_000_000),
  format: z.enum(["webm", "ogg", "wav", "mp3", "mp4", "m4a"]),
}) });

/** Transcribe a draft only: no conversation, retrieval or answer is created. */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const limited = await rateLimitGuard(request, {
    route: "oracle/transcribe", userId,
    userLimit: rateLimits.oracle?.userLimit ?? 15,
    ipLimit: rateLimits.oracle?.ipLimit ?? 60,
    windowMs: rateLimits.oracle?.windowMs,
  });
  if (limited) return limited;
  const parsed = await readJson(request, schema);
  if (!parsed.ok) return parsed.response;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return Response.json({ error: "Transcrição indisponível" }, { status: 503 });
  try {
    const result = await fetchWithTimeout("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST", signal: request.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.ORACLE_STT_MODEL || "openai/whisper-1",
        input_audio: parsed.data.audio, language: "pt" }),
    }, 30_000);
    if (!result.ok) return Response.json({ error: "Não consegui transcrever. Tente novamente." }, { status: 502 });
    const payload = await result.json();
    const transcript = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!transcript) return Response.json({ error: "Não identifiquei fala no áudio. Tente novamente." }, { status: 422 });
    return Response.json({ transcript });
  } catch {
    return Response.json({ error: "Não consegui concluir a transcrição. Tente novamente." }, { status: 502 });
  }
}
