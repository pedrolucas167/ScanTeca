import { ORACLE_ACTIONS, isOracleAction } from "@/lib/oracle-actions";
import type { RoutingDecision } from "@/lib/jev-routing";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { readOracleCompletion } from "./completion";
import { OPENROUTER_BASE, CHAT_MODEL } from "./config";

export async function directChatResponse(question: string, apiKey: string, requestSignal: AbortSignal) {
  const cancellation = new AbortController();
  let consumerCancelled = false;
  const signal = AbortSignal.any([requestSignal, cancellation.signal]);
  try {
    const res = await fetchWithTimeout(`${OPENROUTER_BASE}/chat/completions`, {
      signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Scanteca Oráculo",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: true,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: "Você é o Oráculo de uma biblioteca pessoal. Responda de forma natural e amigável a saudações e conversas casuais. Seja breve e direto.",
          },
          {
            role: "user",
            content: question,
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => undefined);
      return new Response(
        JSON.stringify({ error: "Erro ao responder" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ transcript: question })}\n\n`));
        try {
          await readOracleCompletion(res.body!, { signal, onDelta(text) {
            signal.throwIfAborted();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          } });
          signal.throwIfAborted();
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          if (!consumerCancelled) controller.error(new Error("Não foi possível concluir a resposta. Tente novamente."));
        }
      },
      cancel(reason) { consumerCancelled = true; cancellation.abort(reason); },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    console.error("[oracle] direct chat error");
    return new Response(
      JSON.stringify({ error: "Erro ao responder" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function toolExecutionResponse(routing: RoutingDecision, transcript: string) {
  const action = isOracleAction(routing.tool) ? routing.tool : undefined;
  const message = action ? ORACLE_ACTIONS[action].message : "Escolha uma ação no catálogo para continuar.";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ transcript })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: message, action })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function groundedFallbackResponse() {
  const encoder = new TextEncoder();
  const message =
    "Não encontrei evidências suficientes no seu acervo para responder com segurança. Tente mencionar um título, autor, gênero ou registrar uma reflexão no diário.";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: [] })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: message })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

