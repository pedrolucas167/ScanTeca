import { ORACLE_ACTIONS, isOracleAction } from "@/lib/oracle-actions";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { readOracleCompletion, saveOracleAnswer, getOracleRegenerationTarget, retrieveBooks,
  loadOracleContext, retrieveOracleMemories, MAX_DIARY_ENTRIES, prepareOracleSession, OracleSessionError,
  createEvidenceRegistry, validateCitations, validateInventoryClaims, buildOracleSystemPrompt, updateReaderProfile, createOraclePipeline } from "@/modules/oracle";
import { parseOracleUsage, type OracleUsage } from "@/lib/oracle-usage";
import { NextRequest, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";
import { searchGoogleBooks } from "@/lib/recommendations";
import { normalize } from "@/lib/book-cover";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import {
  jevRouteQuery,
  shouldDirectChat,
  shouldExecuteTool,
  type RoutingDecision,
} from "@/lib/jev-routing";
import { z } from "zod";
import { validateOracleResponse } from "@/lib/oracle-quality";

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
const CHAT_MODEL =
  process.env.ORACLE_CHAT_MODEL || "google/gemini-2.5-flash";
const STT_MODEL = process.env.ORACLE_STT_MODEL || "openai/whisper-1";

const DISTANCE_THRESHOLD = 0.7;
const MAX_TOKENS_CHAT = Number(process.env.ORACLE_MAX_TOKENS || 800);
const MAX_TOKENS_REWRITE = 60;

async function directChatResponse(question: string, apiKey: string, requestSignal: AbortSignal) {
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
  } catch (error) {
    console.error("[oracle] direct chat error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao responder" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function toolExecutionResponse(routing: RoutingDecision, transcript: string) {
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

function groundedFallbackResponse() {
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

async function contextualizeQuestion(
  question: string,
  history: { role: string; content: string }[],
  apiKey: string,
  options: { signal?: AbortSignal; onUsage?: (usage: OracleUsage) => void } = {}
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const res = await fetchWithTimeout(`${OPENROUTER_BASE}/chat/completions`, {
      signal: options.signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Scanteca Oráculo",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: false,
        max_tokens: MAX_TOKENS_REWRITE,
        messages: [
          {
            role: "user",
            content: `Reescreva a última pergunta do leitor como uma pergunta autossuficiente e específica para busca de livros.

REGRAS:
- Incorpore títulos, autores, gêneros, anos e temas citados na conversa
- Se a pergunta usar pronomes ("ele", "esse", "aquele"), substitua pelo nome específico
- Se a pergunta for vaga ("o que sobre X"), torne-a específica ("o que sobre o livro X mencionado anteriormente")
- Se já for autossuficiente e específica, repita-a
- Responda APENAS com a pergunta reescrita, sem explicações

Conversa recente:
${history
  .slice(0, 6)
  .reverse()
  .map(
    (m) =>
      `${m.role === "user" ? "Leitor" : "Oráculo"}: ${m.content.slice(0, 300)}`
  )
  .join("\n")}

Última pergunta do leitor: ${question}`,
          },
        ],
      }),
    });
    if (!res.ok) return question;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: unknown;
    };
    const usage = parseOracleUsage(data.usage);
    if (usage) options.onUsage?.(usage);
    const rewritten = data.choices?.[0]?.message?.content?.trim();
    return rewritten && rewritten.length > 0 && rewritten.length < 500
      ? rewritten
      : question;
  } catch {
    return question;
  }
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

    // Retain the old answer until its replacement can be saved atomically.
    const previousAnswer = regenerate ? await getOracleRegenerationTarget(userId, sessionId) : null;

    return createOraclePipeline({ signal: request.signal, schedule: job => after(job),
      initialEvents: [{ sessionId }, { transcript: trimmed }], run: async pipeline => {
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
      const evidence = createEvidenceRegistry();
      const sources = evidence.sources;

      interface ExternalBook {
        title: string;
        author: string;
        description: string | null;
        genre: string | null;
      }
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

      const context =
        contextBooks.length > 0
          ? contextBooks
              .map(
                (b) => evidence.add({ id: b.id, title: b.title, author: b.author, status: b.status,
                    genre: b.genre, relevance: b.relevance, matchedBy: b.matchedBy,
                    evidence: b.synopsis?.slice(0, 500) ?? `Título: ${b.title}; autor: ${b.author}; status: ${b.status}` },
                  `"${b.title}" — ${b.author}` +
                  (b.publishedDate ? ` (${b.publishedDate})` : "") +
                  (b.genre ? ` [${b.genre}]` : "") +
                  `\n   Status: ${b.status === "READ" ? "Lido" : b.status === "READING" ? "Lendo" : b.status === "TO_READ" ? "A ler" : "Desejo"}` +
                  (b.rating ? ` | Avaliação: ${b.rating}/5` : "") +
                  (b.synopsis ? `\n   Sinopse: ${b.synopsis.slice(0, 500)}` : ""))
              )
              .join("\n\n")
          : "Nenhum livro relevante encontrado no acervo.";

      const progressSection =
        readingNow.length > 0
          ? readingNow
              .map((b) => {
                const dias = b.startedAt
                  ? Math.max(
                      1,
                      Math.round(
                        (Date.now() - b.startedAt.getTime()) / 86400000
                      )
                    )
                  : null;
                return (
                  `- "${b.title}" — ${b.author}` +
                  (b.pages && b.currentPage
                    ? ` | Progresso: pág. ${b.currentPage} de ${b.pages} (${Math.round((b.currentPage / b.pages) * 100)}%)`
                    : "") +
                  (dias
                    ? ` | lendo há ${dias} ${dias === 1 ? "dia" : "dias"}`
                    : "")
                );
              })
              .join("\n")
          : "";

      const weekPages = weekLogs.reduce((s, l) => s + l.pages, 0);
      const weekDays = new Set(
        weekLogs.map((l) => l.date.toISOString().slice(0, 10))
      ).size;
      const weekSection =
        weekPages > 0
          ? `\n\nAtividade recente do usuário: ${weekPages} páginas lidas nos últimos 7 dias, em ${weekDays} ${weekDays === 1 ? "dia" : "dias"} de leitura.`
          : "";

      const relevantDiary = semanticDiary.filter((entry) => Number(entry.distance) < DISTANCE_THRESHOLD);
      const relevantReviews = semanticReviews.filter((review) => Number(review.distance) < DISTANCE_THRESHOLD);
      const relevantExternal = semanticExternal.filter((data) => Number(data.distance) < DISTANCE_THRESHOLD);
      const diaryIntent = /\b(diário|anotações?|memórias?|registros?|reflexões?)\b/i.test(
        retrievalQuery
      );
      const diaryContextEntries = diaryIntent
        ? [...relevantDiary, ...diaryEntries]
        : relevantDiary;
      const diarySection = diaryContextEntries.length
        ? `\n\nMemórias do diário de leitura:\n${diaryContextEntries
            .filter((entry, index, all) => all.findIndex((other) => ("id" in other ? other.id : "") === entry.id) === index)
            .slice(0, MAX_DIARY_ENTRIES)
            .map((entry) => {
              const title = "bookTitle" in entry ? entry.bookTitle : entry.book.title;
              const page = entry.page;
              const author = "bookAuthor" in entry ? entry.bookAuthor : entry.book.author;
              return evidence.add({ id: entry.id, title, author, sourceType: "diary", status: "MEMORY",
                matchedBy: "memória do diário", evidence: entry.content.slice(0, 500) },
                `- [${entry.type}] "${title}"${page ? `, pág. ${page}` : ""}: ${entry.content.slice(0, 500)}`);
            })
            .join("\n")}`
        : "";
      const reviewSection = relevantReviews.length
        ? `\n\nAvaliações relevantes:\n${relevantReviews
            .map((review) => evidence.add({ id: review.id, title: review.bookTitle, author: review.bookAuthor,
              sourceType: "review", status: "REVIEW", matchedBy: "avaliação do leitor", evidence: review.content.slice(0, 500) },
              `- "${review.bookTitle}" — ${review.bookAuthor}${review.rating ? ` (${review.rating}/5)` : ""}: ${review.content.slice(0, 500)}`))
            .join("\n")}`
        : "";
      const externalSection = relevantExternal.length
        ? `\n\nPesquisa externa relevante:\n${relevantExternal
            .map((data) => evidence.add({ id: data.id, title: data.title, author: data.source, external: true,
              matchedBy: "pesquisa externa", evidence: data.content.slice(0, 500) },
              `- [${data.source} - ${data.type}] "${data.title}": ${data.content.slice(0, 500)}`))
            .join("\n")}`
        : "";

      const progressIntent = /\b(lendo|leitura atual|em andamento|progresso|página|paginas|páginas)\b/i.test(
        retrievalQuery
      );
      const hasGrounding =
        contextBooks.length > 0 ||
        relevantDiary.length > 0 ||
        relevantReviews.length > 0 ||
        relevantExternal.length > 0 ||
        (diaryIntent && diaryEntries.length > 0) ||
        (progressIntent && readingNow.length > 0) ||
        externalBooks.length > 0;
      if (!hasGrounding) {
        return groundedFallbackResponse();
      }

      const retrievalStats = {
        durationMs: Date.now() - retrievalStartedAt,
        metadataCandidates, lexicalCandidates, embeddingAvailable: Boolean(questionEmbedding),
        vectorCandidates:
          similarBooks.length + semanticDiary.length + semanticReviews.length + semanticExternal.length,
        selectedBooks: contextBooks.length,
        selectedDiary: relevantDiary.length,
        selectedReviews: relevantReviews.length,
        selectedExternal: relevantExternal.length,
        externalBooks: externalBooks.length,
        scope,
      };

      const externalContext =
        externalBooks.length > 0
          ? `\n\nSugestões fora do acervo (o leitor NÃO possui estes livros):\n${externalBooks
              .map(
                (b, i) => evidence.add({ id: `ext-${i}`, title: b.title, author: b.author, external: true,
                  genre: b.genre, matchedBy: "catálogo externo", evidence: b.description?.slice(0, 300) ?? null },
                  `"${b.title}" — ${b.author} [FORA DO ACERVO]` +
                  (b.genre ? ` [${b.genre}]` : "") +
                  (b.description ? `\n   Sinopse: ${b.description.slice(0, 300)}` : ""))
              )
              .join("\n\n")}`
          : "";

      const profile = setting?.oracleProfile?.trim();
      const systemPrompt = buildOracleSystemPrompt({ mode, scope, profile });

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...conversationHistory.reverse().map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        {
          role: "user" as const,
          content: `Livros relevantes do acervo:\n${context}${externalContext}${progressSection ? `\n\nLeituras em andamento do usuário:\n${progressSection}` : ""}${weekSection}${diarySection}${reviewSection}${externalSection}\n\nPergunta do usuário: ${trimmed}`,
        },
      ];

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
                sources: sources.map(source => ({ ...source })), replacesId: previousAnswer?.id }));
              if (conversationHistory.length >= 4 && setting?.oracleMemoryEnabled !== false) {
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
    } });
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
    if (sessionId) {
      const ownsSession = await prisma.oracleSession.count({
        where: { id: sessionId, userId },
      });
      if (!ownsSession) {
        return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
      }
    }

    const [desc, books, bookStats, setting, sessions, artifacts] = await Promise.all([
      prisma.oracleMessage.findMany({
        where: sessionId ? { userId, sessionId } : { userId, sessionId: null },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.$queryRaw<
        { title: string; author: string; genre: string | null }[]
      >`
        SELECT title, author, genre
        FROM "Book"
        WHERE "userId" = ${userId}
        ORDER BY CASE status WHEN 'READ' THEN 0 WHEN 'TO_READ' THEN 1 ELSE 2 END,
                 RANDOM()
        LIMIT 4
      `,
      prisma.$queryRaw<{ total: bigint; indexed: bigint }[]>`
        SELECT COUNT(*) AS total,
               COUNT(embedding) AS indexed
        FROM "Book"
        WHERE "userId" = ${userId}
      `,
      prisma.librarySetting.findUnique({
        where: { userId },
        select: { oracleProfile: true },
      }),
      prisma.oracleSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { _count: { select: { messages: true, artifacts: true } } },
      }),
      prisma.oracleArtifact.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);

    const stats = {
      total: Number(bookStats[0]?.total ?? 0),
      indexed: Number(bookStats[0]?.indexed ?? 0),
    };

    const suggestions: string[] = [];
    if (books[0]) suggestions.push(`O que ler depois de ${books[0].title}?`);
    if (books[1])
      suggestions.push(`Me recomende algo parecido com ${books[1].title}`);
    const genre = books.find((b) => b.genre)?.genre;
    if (genre) suggestions.push(`O que eu tenho de ${genre}?`);
    else if (books[2])
      suggestions.push(`O que você acha de ${books[2].author}?`);
    if (suggestions.length === 0) {
      suggestions.push(
        "Quais livros eu tenho no meu acervo?",
        "Me recomende um livro para ler agora",
        "Por onde eu começo?"
      );
    }

    return new Response(
      JSON.stringify({
        messages: desc.reverse(),
        suggestions,
        stats,
        profile: setting?.oracleProfile ?? null,
        sessions,
        artifacts,
        activeSessionId: sessionId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em GET /api/oracle:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
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

    await prisma.oracleMessage.deleteMany({ where: { userId } });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro em DELETE /api/oracle:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
