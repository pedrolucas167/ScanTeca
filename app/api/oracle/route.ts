import { NextRequest, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { oracleHttpError } from "@/lib/oracle-http-error";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { jevRouteQuery, shouldDirectChat, shouldExecuteTool } from "@/lib/jev-routing";
import { prepareOracleSession, OracleSessionError, answerOracleQuestion, directChatResponse, toolExecutionResponse, getOracleHome, clearOracleHistory } from "@/modules/oracle";

const ORACLE_MODES = ["RECOMMEND", "EXPLORE", "COMPARE", "JOURNEY", "CURATE", "LOCATE", "ASSISTANT"] as const;

const oracleSchema = z.object({
  question: z.string().nullish(),
  mode: z.enum(ORACLE_MODES).default("EXPLORE"),
  sessionId: z.string().cuid().nullish(),
  temperature: z.coerce.number().min(0).max(2).default(0.3),
  scope: z.enum(["library", "all"]).default("library"),
  regenerate: z.boolean().optional(),
  requestId: z.string().uuid().nullish(),
  audio: z
    .object({
      data: z.string().nullish(),
      format: z.string().nullish(),
    })
    .nullish(),
});

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const STT_MODEL = process.env.ORACLE_STT_MODEL || "openai/whisper-1";

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
      userLimit: rateLimits.oracle?.userLimit ?? 10,
      ipLimit: rateLimits.oracle?.ipLimit ?? 20,
      windowMs: rateLimits.oracle?.windowMs,
    });
    if (rateLimit) return rateLimit;

    const apiKey = process.env.OPENROUTER_API_KEY;
    const parsed = await readJson(request, oracleSchema);
    if (!parsed.ok) return parsed.response;
    const {
      audio,
      mode,
      sessionId: requestedSessionId,
      temperature,
      scope,
      regenerate,
      requestId,
    } = parsed.data;

    let question = parsed.data.question?.trim() ?? "";

    if (!question && audio?.data && !apiKey) return Response.json({ error: "O Oráculo está indisponível no momento. Tente novamente mais tarde." }, { status: 503 });

    if (!question && audio?.data) {
      const sttRes = await fetchWithTimeout(`${OPENROUTER_BASE}/audio/transcriptions`, {
        signal: request.signal,
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
          input_audio: {
            data: audio.data,
            format: audio.format || "webm",
          },
          language: "pt",
        }),
      }, 60_000);
      if (!sttRes.ok) {
        await sttRes.body?.cancel().catch(() => undefined);
        console.error("[oracle] STT error:", sttRes.status);
        return new Response(
          JSON.stringify({ error: "Não consegui transcrever o áudio" }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }
      const sttData = (await sttRes.json()) as { text?: string };
      question = sttData.text?.trim() ?? "";
    }

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Pergunta é obrigatória" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const trimmed = question;

    // Jev Query Routing - decide se precisa de busca vetorial
    const routing = await jevRouteQuery(trimmed);

    if (shouldExecuteTool(routing)) return toolExecutionResponse(routing, trimmed);
    if (!apiKey) return Response.json({ error: "O Oráculo está indisponível no momento. Tente novamente mais tarde." }, { status: 503 });
    if (shouldDirectChat(routing)) return directChatResponse(trimmed, apiKey, request.signal);
    let prepared: Awaited<ReturnType<typeof prepareOracleSession>>;
    try {
      prepared = await prepareOracleSession({ userId, question: trimmed, mode,
        sessionId: requestedSessionId, requestId, regenerate });
    } catch (error) {
      if (error instanceof OracleSessionError) {
        return Response.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
      }
      throw error;
    }
    const { sessionId, currentRequestMessageId } = prepared;

    return answerOracleQuestion({ userId, question: trimmed, mode, sessionId, currentRequestMessageId,
      temperature, scope, regenerate, apiKey, signal: request.signal, schedule: job => after(job) });
  } catch {
    console.error("Erro em POST /api/oracle");
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    return new Response(
      JSON.stringify(await getOracleHome(userId, sessionId)),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) { return oracleHttpError(error, "home GET"); }
}

export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await clearOracleHistory(userId);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) { return oracleHttpError(error, "history DELETE"); }
}
