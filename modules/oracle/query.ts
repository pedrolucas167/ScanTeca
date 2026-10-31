import type { OracleMode } from "@/lib/constants/oracle";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";
import { searchGoogleBooks } from "@/lib/recommendations";
import { normalize } from "@/lib/book-cover";
import { getOracleRegenerationTarget } from "./history";
import { loadOracleContext, retrieveOracleMemories } from "./context";
import { retrieveBooks } from "./retrieval";
import { formatOracleContext, type ExternalBook } from "./context-format";
import { contextualizeQuestion } from "./rewrite";
import { groundedFallbackResponse } from "./responses";
import { buildOracleSystemPrompt } from "./prompt";
import { generateOracleResponse, type OracleChatMessage } from "./generation";
import { createOraclePipeline } from "./pipeline";

export async function answerOracleQuestion({ userId, question: trimmed, mode, sessionId, currentRequestMessageId,
  temperature, scope, regenerate, apiKey, signal: requestSignal, schedule }: {
  userId: string; question: string; mode: OracleMode; sessionId: string; currentRequestMessageId: string | null;
  temperature: number; scope: "library" | "all"; regenerate?: boolean; apiKey: string;
  signal: AbortSignal; schedule: (job: () => Promise<void>) => void;
}) {
  const previousAnswer = regenerate ? await getOracleRegenerationTarget(userId, sessionId) : null;
  return createOraclePipeline({ signal: requestSignal, schedule, initialEvents: [{ sessionId }, { transcript: trimmed }], run: async pipeline => {
    const { signal, stage, metrics } = pipeline;
    const { conversationHistory, setting, readingNow, weekLogs, diaryEntries } = await metrics.measure("context", () =>
      loadOracleContext({ userId, sessionId, question: trimmed, currentRequestMessageId,
        replacesId: previousAnswer?.id, signal }));

    const retrievalQuery = await metrics.measure("rewrite", () => contextualizeQuestion(
      trimmed, conversationHistory, apiKey, { signal, onUsage: usage => metrics.recordUsage("rewrite", usage) }
    ));
    const retrievalStartedAt = Date.now();
    stage("search");
    const questionEmbedding = await metrics.measure("embedding", () => generateEmbedding(retrievalQuery, {
      signal, onUsage: usage => metrics.recordUsage("embedding", usage),
    }));
    signal.throwIfAborted();

    const { similarBooks, semanticDiary, semanticReviews, semanticExternal } = await metrics.measure("retrieval", () =>
      retrieveOracleMemories(userId, questionEmbedding, signal));

    const { books: contextBooks, metadataCandidates, lexicalCandidates } = await metrics.measure("retrieval", () => retrieveBooks(userId, retrievalQuery, similarBooks, mode));

    let externalBooks: ExternalBook[] = [];
    if (scope === "all") {
      stage("external");
      try { await metrics.measure("external", async () => {
        const ownedTitles = new Set(
          (await prisma.book.findMany({
            where: { userId },
            select: { title: true },
          })).map((b) => normalize(b.title).join(" "))
        );
        const items = await searchGoogleBooks(retrievalQuery, signal);
        externalBooks = items
          .map((i) => ({
            title: i.volumeInfo.title?.trim() ?? "",
            author: i.volumeInfo.authors?.join(", ") || "Autor desconhecido",
            description: i.volumeInfo.description ?? null,
            genre: i.volumeInfo.categories?.[0] ?? null,
          }))
          .filter(
            (b) => b.title && !ownedTitles.has(normalize(b.title).join(" "))
          )
          .slice(0, 4);
      }); } catch {
        if (!signal.aborted) console.error("[oracle] external search error");
      }
    }

    const formatted = formatOracleContext({ contextBooks, externalBooks, readingNow, weekLogs, diaryEntries,
      similarBooks, semanticDiary, semanticReviews, semanticExternal, retrievalQuery });
    const { sources, hasGrounding } = formatted;
    if (!hasGrounding) {
      return groundedFallbackResponse();
    }

    const retrievalStats = {
      durationMs: Date.now() - retrievalStartedAt,
      metadataCandidates, lexicalCandidates, embeddingAvailable: Boolean(questionEmbedding),
      vectorCandidates:
        similarBooks.length + semanticDiary.length + semanticReviews.length + semanticExternal.length,
      selectedBooks: contextBooks.length,
      selectedDiary: formatted.selectedDiary,
      selectedReviews: formatted.selectedReviews,
      selectedExternal: formatted.selectedExternal,
      externalBooks: externalBooks.length,
      scope,
    };

    const profile = setting?.oracleProfile?.trim();
    const systemPrompt = buildOracleSystemPrompt({ mode, scope, profile });

    const messages: OracleChatMessage[] = [
      { role: "system" as const, content: systemPrompt },
      ...[...conversationHistory].reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `${formatted.content}\n\nPergunta do usuário: ${trimmed}`,
      },
    ];

    return generateOracleResponse({ pipeline, userId, sessionId, mode, question: trimmed, apiKey, temperature,
      messages, sources, retrievalStats, setting, conversationLength: conversationHistory.length, replacesId: previousAnswer?.id });
  } });
}
