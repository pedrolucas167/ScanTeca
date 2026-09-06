import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const TTS_MODEL = process.env.ORACLE_TTS_MODEL || "openai/tts-1";
const TTS_VOICE = process.env.ORACLE_TTS_VOICE || "nova";

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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const { text } = (await request.json()) as { text?: string };
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

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
        model: TTS_MODEL,
        input: text.trim().slice(0, 1500),
        voice: TTS_VOICE,
        response_format: "mp3",
      }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text();
      console.error("[oracle] TTS error:", res.status, err);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar a voz do Oráculo" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(res.body, {
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
