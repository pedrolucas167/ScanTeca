import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const VOICE_MODEL =
  process.env.ORACLE_VOICE_MODEL || "openai/gpt-audio-mini";
const VOICE_VOICE = process.env.ORACLE_VOICE_VOICE || "nova";
const VOICE_FORMAT = process.env.ORACLE_VOICE_FORMAT || "mp3";
const STT_MODEL = process.env.ORACLE_STT_MODEL || "openai/whisper-1";

const voiceSchema = z.object({
  audio: z
    .object({
      data: z.string(),
      format: z.string(),
    })
    .nullish(),
  mode: z.string().default("EXPLORE"),
  sessionId: z.string().cuid().nullish(),
  temperature: z.coerce.number().min(0).max(2).default(1),
});

interface BookContext {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  status: string;
  rating: number | null;
  synopsis: string | null;
  publishedDate: string | null;
}

function buildSystemPrompt(
  books: BookContext[],
  mode: string,
  profile?: string | null
) {
  const modeText: Record<string, string> = {
    RECOMMEND: "Recomende livros do acervo de forma calorosa e natural.",
    EXPLORE: "Explore conexões e temas do acervo com o leitor.",
    COMPARE: "Compare obras do acervo de forma clara.",
    JOURNEY: "Ajude o leitor a continuar sua jornada de leitura.",
    CURATE: "Crie uma curadoria de leitura com base no acervo.",
    LOCATE: "Ajude o leitor a encontrar livros específicos no acervo.",
    ASSISTANT:
      "Aja como um assistente pessoal atencioso e conversador sobre o acervo.",
  };
  const ctx = books.length
    ? books
        .slice(0, 8)
        .map(
          (b, i) =>
            `${i + 1}. "${b.title}" — ${b.author}` +
            (b.publishedDate ? ` (${b.publishedDate})` : "") +
            (b.genre ? ` [${b.genre}]` : "") +
            ` | Status: ${b.status}` +
            (b.rating ? ` | Nota: ${b.rating}/5` : "") +
            (b.synopsis ? `\n   Sinopse: ${b.synopsis.slice(0, 150)}` : "")
        )
        .join("\n")
    : "Acervo vazio.";
  return `Você é o Oráculo de voz de uma biblioteca pessoal. Converse de forma natural, leve e calorosa em português do Brasil sobre os livros do leitor.

Modo: ${mode}.
${modeText[mode] ?? modeText.EXPLORE}
${profile ? `\nPerfil do leitor:\n${profile}` : ""}

Livros do acervo:
${ctx}

Responda de forma breve, como numa conversa de voz, e termine com calor humano.`;
}

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
      route: "oracle",
      userId,
      ...rateLimits.oracle,
    });
    if (rateLimit) return rateLimit;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = await readJson(request, voiceSchema);
    if (!parsed.ok) return parsed.response;
    const { audio, mode, sessionId, temperature } = parsed.data;

    if (!audio?.data) {
      return new Response(
        JSON.stringify({ error: "Áudio é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const sttRes = await fetch(`${OPENROUTER_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Scanteca Oráculo",
      },
      body: JSON.stringify({
        model: STT_MODEL,
        input_audio: { data: audio.data, format: audio.format || "webm" },
        language: "pt",
      }),
    });
    if (!sttRes.ok) {
      const err = await sttRes.text();
      console.error("[oracle/voice] STT error:", sttRes.status, err);
      return new Response(
        JSON.stringify({ error: "Não consegui transcrever o áudio" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    const sttData = (await sttRes.json()) as { text?: string };
    const question = sttData.text?.trim() ?? "";
    if (!question) {
      return new Response(
        JSON.stringify({ error: "Não entendi o áudio" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let sessionIdToUse = sessionId;
    if (!sessionIdToUse) {
      const session = await prisma.oracleSession.create({
        data: { userId, title: question.slice(0, 80), mode },
      });
      sessionIdToUse = session.id;
    } else {
      const owns = await prisma.oracleSession.count({
        where: { id: sessionIdToUse, userId },
      });
      if (!owns) {
        return Response.json(
          { error: "Conversa não encontrada" },
          { status: 404 }
        );
      }
    }

    await prisma.oracleMessage.create({
      data: {
        userId,
        sessionId: sessionIdToUse,
        role: "user",
        content: question,
      },
    });

    const setting = await prisma.librarySetting.findUnique({ where: { userId } });
    const books = await prisma.book.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        author: true,
        genre: true,
        status: true,
        rating: true,
        synopsis: true,
        publishedDate: true,
      },
      take: 8,
    });

    const systemPrompt = buildSystemPrompt(books, mode, setting?.oracleProfile);

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: question },
    ];

    const llmRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Scanteca Oráculo",
      },
      body: JSON.stringify({
        model: VOICE_MODEL,
        messages,
        stream: true,
        temperature,
        max_tokens: 250,
        modalities: ["text", "audio"],
        audio: { voice: VOICE_VOICE, format: VOICE_FORMAT },
      }),
    });

    if (!llmRes.ok || !llmRes.body) {
      const err = await llmRes.text();
      console.error("[oracle/voice] OpenRouter error:", llmRes.status, err);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar o Oráculo de voz" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = llmRes.body.getReader();

    let fullTranscript = "";

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              sessionId: sessionIdToUse,
              transcript: question,
            })}\n\n`
          )
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const json = JSON.parse(payload);
                const audioDelta = json.choices?.[0]?.delta?.audio;
                const text = json.choices?.[0]?.delta?.content;
                if (audioDelta?.data) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        audio: audioDelta.data,
                        transcript: audioDelta.transcript ?? "",
                      })}\n\n`
                    )
                  );
                  if (audioDelta.transcript) fullTranscript += audioDelta.transcript;
                }
                if (text) {
                  fullTranscript += text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("[oracle/voice] stream error:", err);
        } finally {
          await prisma.oracleMessage.create({
            data: {
              userId,
              sessionId: sessionIdToUse,
              role: "assistant",
              content: fullTranscript || "Resposta em áudio",
            },
          });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[oracle/voice] error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
