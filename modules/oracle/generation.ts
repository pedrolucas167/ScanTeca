import type { LibrarySetting } from "@prisma/client";
import type { OracleMode } from "@/lib/constants/oracle";
import type { Source, RetrievalStats } from "@/lib/types/oracle";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { validateOracleResponse } from "@/lib/oracle-quality";
import { readOracleCompletion } from "./completion";
import { validateCitations, validateInventoryClaims } from "./evidence";
import { saveOracleAnswer } from "./history";
import { updateReaderProfile } from "./profile";
import type { OraclePipelineContext } from "./pipeline";
import { OPENROUTER_BASE, CHAT_MODEL, MAX_TOKENS_CHAT } from "./config";

export interface OracleChatMessage { role: "system" | "user" | "assistant"; content: string }
export async function generateOracleResponse({ pipeline, userId, sessionId, mode, question: trimmed, apiKey,
  temperature, messages, sources, retrievalStats, setting, conversationLength, replacesId }: {
  pipeline: OraclePipelineContext; userId: string; sessionId: string; mode: OracleMode; question: string; apiKey: string;
  temperature: number; messages: OracleChatMessage[]; sources: Source[]; retrievalStats: RetrievalStats;
  setting: Pick<LibrarySetting, "oracleProfile" | "oracleMemoryEnabled" | "oracleProfileVersion"> | null;
  conversationLength: number; replacesId?: string;
}) {
  const { signal, stage, metrics } = pipeline;
  const cancellation = new AbortController();
  let consumerCancelled = false;
  const generationSignal = AbortSignal.any([signal, cancellation.signal]);
  stage("generation");
  const llmRes = await metrics.measure("generation", () => fetchWithTimeout(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    signal: generationSignal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Scanteca Oráculo",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      stream: true,
      temperature,
      max_tokens: MAX_TOKENS_CHAT,
    }),
  }, 60_000));

  if (!llmRes.ok || !llmRes.body) {
    await llmRes.body?.cancel().catch(() => undefined);
    console.error("[oracle] OpenRouter chat error:", llmRes.status);
    return new Response(
      JSON.stringify({ error: "Erro ao consultar o Oráculo" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
      );
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ retrievalStats })}\n\n`)
      );

      try {
        const fullText = await metrics.measure("generation", () => readOracleCompletion(llmRes.body!, {
          signal: generationSignal, onUsage: usage => metrics.recordUsage("generation", usage),
        }));
        stage("validation");
        const quality = await metrics.measure("validation", () => {
          const citationCheck = validateCitations(fullText, sources.length);
          const inventoryCheck = validateInventoryClaims(fullText);
          return !citationCheck.valid ? { valid: false, reason: "citação sem fonte correspondente" }
            : !inventoryCheck.valid ? { valid: false, reason: "ausência no acervo inferida de contexto parcial" }
              : validateOracleResponse(fullText);
        });
        const outputText = quality.valid
          ? fullText.trim()
          : "Não consegui gerar uma resposta confiável com as evidências disponíveis. Tente reformular a pergunta.";
        if (!quality.valid) {
          pipeline.reject();
          console.warn("[oracle] response rejected:", quality.reason);
        }

        generationSignal.throwIfAborted();
        if (quality.valid) {
          stage("persistence");
          await metrics.measure("persistence", () => saveOracleAnswer({ userId, sessionId, mode, content: outputText,
            sources: sources.map(source => ({ ...source })), replacesId: replacesId }));
          if (conversationLength >= 4 && setting?.oracleMemoryEnabled !== false) {
            pipeline.defer(() => updateReaderProfile({ userId, snapshot: { oracleProfile: setting?.oracleProfile ?? null,
              oracleMemoryEnabled: setting?.oracleMemoryEnabled ?? true, oracleProfileVersion: setting?.oracleProfileVersion ?? 0 },
              question: trimmed, apiKey, model: CHAT_MODEL, signal: AbortSignal.timeout(8000) }));
          }
        }
        generationSignal.throwIfAborted();
        // Extract and send citations
        const citations = validateCitations(outputText, sources.length).citations;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: outputText })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ citations })}\n\n`)
        );
      } catch {
        if (consumerCancelled) return;
        console.error("[oracle] completion failed");
        controller.error(new Error("Não foi possível concluir a resposta. Tente novamente."));
        return;
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
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

}
