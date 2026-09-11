import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const ttsSchema = z.object({
  text: z.string("Texto é obrigatório").trim().min(1, "Texto é obrigatório"),
});

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const TTS_VOICE = process.env.ORACLE_TTS_VOICE || "nova";
const TTS_INSTRUCTIONS = process.env.ORACLE_TTS_INSTRUCTIONS || "";
const TTS_MODELS = [
  process.env.ORACLE_TTS_MODEL,
  "openai/tts-1-hd",
  "openai/tts-1",
].filter(Boolean) as string[];

/** POST /api/oracle/tts — texto → voz via endpoint de speech do OpenRouter. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rateLimit = await rateLimitGuard(request, {
      route: "oracle/tts",
      userId,
      ...rateLimits["oracle/tts"],
    });
    if (rateLimit) return rateLimit;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = await readJson(request, ttsSchema);
    if (!parsed.ok) return parsed.response;
    const { text } = parsed.data;

    const trimmedText = text.trim().slice(0, 1500);
    let lastError = "";
    let responseBody: ReadableStream<Uint8Array> | null = null;

    for (const model of TTS_MODELS) {
      const res = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Scanteca Oráculo",
        },
        body: JSON.stringify({
          model,
          input: trimmedText,
          voice: TTS_VOICE,
          response_format: "mp3",
          ...(TTS_INSTRUCTIONS
            ? {
                provider: {
                  options: {
                    openai: { instructions: TTS_INSTRUCTIONS },
                  },
                },
              }
            : {}),
        }),
      });

      if (res.ok && res.body) {
        responseBody = res.body;
        break;
      }
      lastError = await res.text();
      console.error("[oracle] TTS error:", res.status, model, lastError);
    }

    if (!responseBody) {
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar a voz do Oráculo",
          details: lastError.slice(0, 200),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(responseBody, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Erro em POST /api/oracle/tts:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
