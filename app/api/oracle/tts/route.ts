import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { generateOracleSpeech } from "@/modules/oracle";
import { z } from "zod";

const ttsSchema = z.object({
  text: z.string("Texto é obrigatório").trim().min(1, "Texto é obrigatório"),
});

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
      userLimit: rateLimits["broadcast"]?.userLimit ?? 10, ipLimit: rateLimits["broadcast"]?.ipLimit ?? 20, windowMs: rateLimits["broadcast"]?.windowMs,
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

    const speech = await generateOracleSpeech(text, apiKey);

    if (!speech.ok) {
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar a voz do Oráculo",
          details: speech.lastError.slice(0, 200),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(speech.body, {
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
