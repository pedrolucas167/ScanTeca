import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
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
import { jevExtractFilters, filtersToWhereClause } from "@/lib/jev-filtering";
import { jevRerank, mergeAndRerank } from "@/lib/jev-reranking";
import { z } from "zod";
import {
  isCorruptedHistoryMessage,
  validateOracleResponse,
} from "@/lib/oracle-quality";

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

interface SimilarBook {
  id: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  genre: string | null;
  status: string;
  rating: number | null;
  distance: number;
  relevance?: number;
}

interface DiaryMemory {
  id: string;
  type: string;
  content: string;
  page: number | null;
  tags: string[];
  bookTitle: string;
  bookAuthor: string;
  distance: number;
}

interface ReviewMemory {
  id: string;
  content: string;
  rating: number | null;
  bookTitle: string;
  bookAuthor: string;
  distance: number;
}

const HISTORY_LIMIT = 8;
const DISTANCE_THRESHOLD = 0.7;
const MAX_CONTEXT_BOOKS = 4;
const MAX_DIARY_ENTRIES = 8;
const MAX_RAG_MEMORIES = 6;
const MAX_TOKENS_CHAT = Number(process.env.ORACLE_MAX_TOKENS || 800);
const MAX_TOKENS_PROFILE = 120;
const MAX_TOKENS_REWRITE = 60;

async function updateReaderProfile(
  userId: string,
  currentProfile: string | null | undefined,
  question: string,
  answer: string,
  apiKey: string
) {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
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
        max_tokens: MAX_TOKENS_PROFILE,
        messages: [
          {
            role: "user",
            content: `Você mantém o perfil de um leitor com base nas conversas dele com um oráculo literário.

Perfil atual:
${currentProfile?.trim() || "(vazio)"}

Última interação:
Leitor: ${question}
Oráculo: ${answer.slice(0, 800)}

Reescreva o perfil em até 5 linhas curtas: gêneros/autores preferidos, livros citados, momento de leitura, pedidos recorrentes. Se nada novo foi revelado, responda exatamente: SEM MUDANÇA. Responda apenas com o perfil.`,
          },
        ],
      }),
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text && !text.startsWith("SEM MUDAN")) {
      await prisma.librarySetting.upsert({
        where: { userId },
        create: { userId, oracleProfile: text },
        update: { oracleProfile: text },
      });
    }
  } catch (err) {
    console.error("[oracle] profile update error:", err);
  }
}

async function directChatResponse(question: string, apiKey: string) {
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
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
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        let buffer = "";
        const processPayload = (payload: string) => {
          if (!payload || payload === "[DONE]") return;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
              );
            }
          } catch (error) {
            console.warn("[oracle] invalid direct-chat SSE payload:", {
              error,
              payload: payload.slice(0, 200),
            });
          }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                processPayload(buffer.trim().replace(/^data:\s*/, ""));
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              processPayload(payload);
            }
          }
        } finally {
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
    console.error("[oracle] direct chat error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao responder" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function toolExecutionResponse(routing: RoutingDecision) {
  // TODO: Implement tool execution logic
  // For now, return a message indicating the feature is coming soon
  const toolMessages: Record<string, string> = {
    create_route: "Para criar uma rota de leitura, use o recurso de Rotas na biblioteca. Selecione os livros e clique em 'Criar rota'.",
    add_book: "Para adicionar um livro, use o scanner de ISBN ou cadastro manual na página de catálogo.",
    update_status: "Para atualizar o status de leitura, abra o livro e selecione o status desejado.",
    unknown: "Entendi que você quer executar uma ação. Essa funcionalidade estará disponível em breve.",
  };

  const message = toolMessages[routing.tool ?? "unknown"] || toolMessages.unknown;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
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

function groundedFallbackResponse(sessionId: string | null) {
  const encoder = new TextEncoder();
  const message =
    "Não encontrei evidências suficientes no seu acervo para responder com segurança. Tente mencionar um título, autor, gênero ou registrar uma reflexão no diário.";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionId })}\n\n`));
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
  apiKey: string
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
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
    };
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
      ...rateLimits.oracle,
    });
    if (rateLimit) return rateLimit;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "OPENROUTER_API_KEY não configurada. Adicione a chave no .env para usar o Oráculo.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

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

    if (!question && audio?.data) {
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
          input_audio: {
            data: audio.data,
            format: audio.format || "webm",
          },
          language: "pt",
        }),
      });
      if (!sttRes.ok) {
        const err = await sttRes.text();
        console.error("[oracle] STT error:", sttRes.status, err);
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

    // Direct chat response for greetings and casual conversation
    if (shouldDirectChat(routing)) {
      return directChatResponse(trimmed, apiKey);
    }

    // Tool execution for specific actions
    if (shouldExecuteTool(routing)) {
      return toolExecutionResponse(routing);
    }
    let sessionId = requestedSessionId ?? null;
    let currentRequestMessageId: string | null = null;
    try {
      sessionId = await prisma.$transaction(async (tx) => {
        let currentSessionId = sessionId;
        if (currentSessionId) {
          const ownsSession = await tx.oracleSession.count({
            where: { id: currentSessionId, userId },
          });
          if (!ownsSession) throw new Error("Conversa não encontrada");
        } else {
          const session = await tx.oracleSession.create({
            data: { userId, title: trimmed.slice(0, 80), mode },
          });
          currentSessionId = session.id;
        }

        if (!regenerate) {
          const message = await tx.oracleMessage.create({
            data: {
              userId,
              sessionId: currentSessionId,
              role: "user",
              content: trimmed,
              requestId,
            },
          });
          currentRequestMessageId = message.id;
        }
        return currentSessionId;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Error && error.message === "Conversa não encontrada") {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return Response.json(
          { error: "Esta pergunta já está sendo processada." },
          { status: 409 }
        );
      }
      throw error;
    }

    // Regenerate: apaga a última resposta do assistente antes de montar o
    // histórico — a pergunta do usuário já existe e não é recriada.
    if (regenerate) {
      const lastAssistant = await prisma.oracleMessage.findFirst({
        where: { userId, sessionId, role: "assistant" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (lastAssistant) {
        await prisma.oracleMessage.delete({ where: { id: lastAssistant.id } });
      }
    }

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const [historyDesc, setting, , readingNow, weekLogs, diaryEntries] = await Promise.all([
      prisma.oracleMessage.findMany({
        where: { userId, sessionId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      prisma.librarySetting.findUnique({ where: { userId } }),
      Promise.resolve(null),
      prisma.book.findMany({
        where: { userId, status: "READING" },
        select: {
          title: true,
          author: true,
          currentPage: true,
          pages: true,
          startedAt: true,
        },
      }),
      prisma.readingLog.findMany({
        where: { userId, date: { gte: weekAgo } },
        select: { date: true, pages: true },
      }),
      prisma.diaryEntry.findMany({
        where: { userId, ragEnabled: true },
        orderBy: { createdAt: "desc" },
        take: MAX_DIARY_ENTRIES,
        select: {
          type: true,
          content: true,
          page: true,
          id: true,
          book: { select: { title: true, author: true } },
        },
      }),
    ]);

    // The current question is already persisted above. It is sent separately
    // in the final prompt and must not be duplicated in the conversation.
    const conversationHistory = historyDesc.filter((message, index) => {
      if (message.role === "assistant" && isCorruptedHistoryMessage(message.content)) {
        return false;
      }
      if (currentRequestMessageId) return message.id !== currentRequestMessageId;
      return !(index === 0 && message.role === "user" && message.content === trimmed);
    });

    const retrievalQuery = await contextualizeQuestion(
      trimmed,
      conversationHistory,
      apiKey
    );
    const retrievalStartedAt = Date.now();
    const questionEmbedding = await generateEmbedding(retrievalQuery);

    if (!questionEmbedding) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar embedding da pergunta" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const vector = `[${questionEmbedding.join(",")}]`;
    const [similarBooks, semanticDiary, semanticReviews] = await Promise.all([
      prisma.$queryRaw<SimilarBook[]>`
      SELECT id, title, author, "publishedDate", synopsis, genre,
             status::text as status, rating,
             embedding <=> ${vector}::vector AS distance
      FROM "Book"
      WHERE "userId" = ${userId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT 5
      `,
      prisma.$queryRaw<DiaryMemory[]>`
        SELECT d.id, d.type, d.content, d.page, d.tags,
               b.title AS "bookTitle", b.author AS "bookAuthor",
               d.embedding <=> ${vector}::vector AS distance
        FROM "DiaryEntry" d
        JOIN "Book" b ON b.id = d."bookId"
        WHERE d."userId" = ${userId}
          AND d."ragEnabled" = true
          AND d.embedding IS NOT NULL
        ORDER BY d.embedding <=> ${vector}::vector
        LIMIT ${MAX_RAG_MEMORIES}
      `,
      prisma.$queryRaw<ReviewMemory[]>`
        SELECT r.id, r.content, r.rating,
               b.title AS "bookTitle", b.author AS "bookAuthor",
               r.embedding <=> ${vector}::vector AS distance
        FROM "Review" r
        JOIN "Book" b ON b.id = r."bookId"
        WHERE b."userId" = ${userId}
          AND r.embedding IS NOT NULL
        ORDER BY r.embedding <=> ${vector}::vector
        LIMIT ${MAX_RAG_MEMORIES}
      `,
    ]);

    const relevantBooks = similarBooks.filter(
      (b) => Number(b.distance) < DISTANCE_THRESHOLD
    );

    // Jev Metadata Filtering - extract structured filters from query
    const metadataFilters = await jevExtractFilters(retrievalQuery);
    const whereClause = filtersToWhereClause(metadataFilters, userId);

    // Escopo ampliado: busca livros fora do acervo no Google Books.
    interface ExternalBook {
      title: string;
      author: string;
      description: string | null;
      genre: string | null;
    }
    let externalBooks: ExternalBook[] = [];
    if (scope === "all") {
      try {
        const ownedTitles = new Set(
          (await prisma.book.findMany({
            where: { userId },
            select: { title: true },
          })).map((b) => normalize(b.title).join(" "))
        );
        const items = await searchGoogleBooks(retrievalQuery);
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
      } catch (err) {
        console.error("[oracle] external search error:", err);
      }
    }

    // Use Jev filters to fetch additional books
    const hasFilters = Object.keys(metadataFilters).length > 0;
    
    let contextBooks = relevantBooks;
    
    if (hasFilters) {
      const metaRows = await prisma.book.findMany({
        where: whereClause,
        take: 8,
      });
      
      // Convert to BookCandidate format for Jev reranking
      const semanticCandidates = relevantBooks.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        publishedDate: b.publishedDate,
        synopsis: b.synopsis,
        genre: b.genre,
        status: b.status,
        rating: b.rating,
        distance: Number(b.distance),
      }));
      
      const metadataCandidates = metaRows
        .filter((b) => !relevantBooks.some((rb) => rb.id === b.id))
        .map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          publishedDate: b.publishedDate,
          synopsis: b.synopsis,
          genre: b.genre,
          status: String(b.status),
          rating: b.rating,
          distance: undefined, // No semantic match for metadata-only results
        }));
      
      // Use Jev reranking to merge and score results
      const reranked = await mergeAndRerank(
        retrievalQuery,
        semanticCandidates,
        metadataCandidates,
        { mode, threshold: 40, maxResults: MAX_CONTEXT_BOOKS }
      );
      
      // Map reranked results back to SimilarBook format
      const allCandidates = [...semanticCandidates, ...metadataCandidates];
      contextBooks = reranked.flatMap((r) => {
          const candidate = allCandidates.find((c) => c.id === r.id);
          // Metadata matches narrow retrieval but are not evidence by
          // themselves unless the book also has a semantic match.
          if (!candidate || candidate.distance === undefined) return [];
          return [{
            id: candidate.id,
            title: candidate.title,
            author: candidate.author,
            publishedDate: candidate.publishedDate,
            synopsis: candidate.synopsis,
            genre: candidate.genre,
            status: candidate.status,
            rating: candidate.rating,
            distance: candidate.distance ?? 1,
            relevance: r.relevance,
          }];
        });
    } else {
      // No filters, just use semantic results with Jev reranking
      const candidates = relevantBooks.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        publishedDate: b.publishedDate,
        synopsis: b.synopsis,
        genre: b.genre,
        status: b.status,
        rating: b.rating,
        distance: Number(b.distance),
      }));
      
      const reranked = await jevRerank(retrievalQuery, candidates, {
        mode,
        threshold: 40,
        maxResults: MAX_CONTEXT_BOOKS,
      });
      
      contextBooks = reranked.flatMap((r) => {
          const candidate = candidates.find((c) => c.id === r.id);
          if (!candidate) return [];
          return [{
            id: candidate.id,
            title: candidate.title,
            author: candidate.author,
            publishedDate: candidate.publishedDate,
            synopsis: candidate.synopsis,
            genre: candidate.genre,
            status: candidate.status,
            rating: candidate.rating,
            distance: candidate.distance,
            relevance: r.relevance,
          }];
        });
    }

    const context =
      contextBooks.length > 0
        ? contextBooks
            .map(
              (b, i) =>
                `${i + 1}. "${b.title}" — ${b.author}` +
                (b.publishedDate ? ` (${b.publishedDate})` : "") +
                (b.genre ? ` [${b.genre}]` : "") +
                `\n   Status: ${b.status === "READ" ? "Lido" : b.status === "READING" ? "Lendo" : b.status === "TO_READ" ? "A ler" : "Desejo"}` +
                (b.rating ? ` | Avaliação: ${b.rating}/5` : "") +
                (b.synopsis ? `\n   Sinopse: ${b.synopsis.slice(0, 500)}` : "")
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
            return `- [${entry.type}] "${title}"${page ? `, pág. ${page}` : ""}: ${entry.content.slice(0, 500)}`;
          })
          .join("\n")}`
      : "";
    const reviewSection = relevantReviews.length
      ? `\n\nAvaliações relevantes:\n${relevantReviews
          .map((review) => `- "${review.bookTitle}" — ${review.bookAuthor}${review.rating ? ` (${review.rating}/5)` : ""}: ${review.content.slice(0, 500)}`)
          .join("\n")}`
      : "";

    const progressIntent = /\b(lendo|leitura atual|em andamento|progresso|página|paginas|páginas)\b/i.test(
      retrievalQuery
    );
    const hasGrounding =
      contextBooks.length > 0 ||
      relevantDiary.length > 0 ||
      relevantReviews.length > 0 ||
      (diaryIntent && diaryEntries.length > 0) ||
      (progressIntent && readingNow.length > 0) ||
      externalBooks.length > 0;
    if (!hasGrounding) {
      return groundedFallbackResponse(sessionId);
    }

    const retrievalStats = {
      durationMs: Date.now() - retrievalStartedAt,
      vectorCandidates:
        similarBooks.length + semanticDiary.length + semanticReviews.length,
      selectedBooks: contextBooks.length,
      selectedDiary: relevantDiary.length,
      selectedReviews: relevantReviews.length,
      externalBooks: externalBooks.length,
      scope,
    };

    const externalContext =
      externalBooks.length > 0
        ? `\n\nSugestões fora do acervo (o leitor NÃO possui estes livros):\n${externalBooks
            .map(
              (b, i) =>
                `${contextBooks.length + i + 1}. "${b.title}" — ${b.author} [FORA DO ACERVO]` +
                (b.genre ? ` [${b.genre}]` : "") +
                (b.description ? `\n   Sinopse: ${b.description.slice(0, 300)}` : "")
            )
            .join("\n\n")}`
        : "";

    const profile = setting?.oracleProfile?.trim();
    const modeInstructions: Record<
      typeof ORACLE_MODES[number],
      string
    > = {
      RECOMMEND: "Recomende de 1 a 3 livros, justifique cada escolha pelo momento do leitor e termine com uma indicação principal.",
      EXPLORE: "Explore conexões entre temas, autores e obras do acervo com profundidade, sem transformar toda resposta em recomendação.",
      COMPARE: "Compare explicitamente temas, estilo, ritmo, complexidade e momento ideal de leitura das obras mencionadas.",
      JOURNEY: "Considere leituras em andamento, atividade recente e objetivo do leitor para propor o próximo passo sustentável da jornada.",
      CURATE: "Crie uma sequência ordenada de leitura com progressão clara e explique a função de cada obra na curadoria.",
      LOCATE: "Priorize identificar os volumes pedidos e oriente o leitor a usar a ação Criar rota exibida nas fontes.",
      ASSISTANT: "Aja como um assistente pessoal atencioso e leve: responva dúvidas do dia a dia sobre leituras, organize lembretes, e converse com naturalidade sem soar como um bibliotecário formal.",
    };
    const systemPrompt = `Você é o Oráculo de uma biblioteca pessoal — um bibliotecário erudito e apaixonado por literatura, com o tom de um curador de uma biblioteca clássica. Você CONHECE este leitor: use o perfil e o histórico da conversa para personalizar respostas, retomar assuntos anteriores e fazer recomendações cada vez mais afinadas.

REGRAS CRÍTICAS PARA EVITAR ALUCINAÇÕES:
- Use APENAS as informações fornecidas no contexto (livros listados, diário, progresso e catálogo externo marcado)
- NÃO invente informações sobre livros que não estão no contexto
- NÃO faça suposições sobre autores, datas, sinopses ou conteúdo não mencionado
- Se não tiver informação suficiente para responder, diga honestamente que não sabe
- NÃO cite como pertencentes ao acervo livros que não aparecem na lista de "Livros relevantes do acervo"
- Quando recomendar dentro da biblioteca, baseie-se APENAS nos livros listados no contexto
- Cada afirmação factual deve ser sustentada por uma fonte do contexto
- Se a evidência for insuficiente, diga honestamente que não sabe; não preencha lacunas com conhecimento geral
- Se a pergunta for sobre um livro não listado, diga que não tem informações sobre ele no acervo

Modo atual: ${mode}.
Instrução específica: ${modeInstructions[mode]}
${scope === "all" ? "\nEscopo ampliado: você pode sugerir livros fora do acervo — eles aparecem marcados como [FORA DO ACERVO] no contexto. Deixe claro ao leitor quando uma sugestão não está na estante dele." : ""}
${profile ? `\n\nO que você já sabe sobre este leitor:\n${profile}` : ""}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `Livros relevantes do acervo:\n${context}${externalContext}${progressSection ? `\n\nLeituras em andamento do usuário:\n${progressSection}` : ""}${weekSection}${diarySection}${reviewSection}\n\nPergunta do usuário: ${trimmed}`,
      },
    ];

    const llmRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
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
    });

    if (!llmRes.ok || !llmRes.body) {
      const err = await llmRes.text();
      console.error("[oracle] OpenRouter chat error:", llmRes.status, err);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar o Oráculo" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = llmRes.body!.getReader();
        let buffer = "";
        let fullText = "";
        const processPayload = (payload: string) => {
          if (!payload || payload === "[DONE]") return;
          try {
            const json = JSON.parse(payload);
            const content = json.choices?.[0]?.delta?.content;
            if (typeof content === "string") {
              fullText += content;
            } else if (Array.isArray(content)) {
              fullText += content
                .filter(
                  (part: unknown): part is { text: string } =>
                    typeof part === "object" &&
                    part !== null &&
                    "text" in part &&
                    typeof (part as { text?: unknown }).text === "string"
                )
                .map((part) => part.text)
                .join("");
            }
          } catch (error) {
            console.warn("[oracle] invalid SSE payload:", {
              error,
              payload: payload.slice(0, 200),
            });
          }
        };

        const sources: {
          id: string;
          title: string;
          author: string;
          status: string;
          genre: string | null;
          relevance: number | null;
          matchedBy: string;
          evidence: string | null;
          sourceType?: "book" | "diary" | "review";
          external?: boolean;
        }[] = contextBooks.map((b) => {
          const distance = Number(b.distance);
          const vectorMatch = distance > 0 && distance < DISTANCE_THRESHOLD;
          const relevance = b.relevance ?? (vectorMatch
            ? Math.max(0, Math.min(100, Math.round((1 - distance) * 100)))
            : null);
          const matchedBy = vectorMatch
            ? "similaridade semântica"
            : hasFilters
              ? "filtros de metadados"
              : "metadados do acervo";
          return {
            id: b.id,
            title: b.title,
            author: b.author,
            status: b.status,
            genre: b.genre,
            relevance,
            matchedBy,
            evidence: b.synopsis?.slice(0, 180) ?? null,
          };
        });
        for (const memory of relevantDiary) {
          sources.push({
            id: memory.id,
            title: memory.bookTitle,
            author: memory.bookAuthor,
            status: "MEMORY",
            genre: null,
            relevance: Math.round((1 - Number(memory.distance)) * 100),
            matchedBy: "memória do diário",
            evidence: memory.content.slice(0, 180),
            sourceType: "diary",
          });
        }
        for (const review of relevantReviews) {
          sources.push({
            id: review.id,
            title: review.bookTitle,
            author: review.bookAuthor,
            status: "REVIEW",
            genre: null,
            relevance: Math.round((1 - Number(review.distance)) * 100),
            matchedBy: "avaliação do leitor",
            evidence: review.content.slice(0, 180),
            sourceType: "review",
          });
        }
        for (const [i, b] of externalBooks.entries()) {
          sources.push({
            id: `ext-${i}`,
            title: b.title,
            author: b.author,
            status: "EXTERNAL",
            genre: b.genre,
            relevance: null,
            matchedBy: "catálogo externo",
            evidence: b.description?.slice(0, 180) ?? null,
            external: true,
          });
        }
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sessionId })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ transcript: trimmed })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ retrievalStats })}\n\n`)
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                processPayload(buffer.trim().replace(/^data:\s*/, ""));
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              processPayload(payload);
            }
          }
        } finally {
          try {
            const quality = validateOracleResponse(fullText);
            const outputText = quality.valid
              ? fullText.trim()
              : "Não consegui gerar uma resposta confiável com as evidências disponíveis. Tente reformular a pergunta.";
            if (!quality.valid) {
              console.warn("[oracle] response rejected:", quality.reason);
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: outputText })}\n\n`)
            );
            const persist: Promise<unknown>[] = [];
            if (quality.valid) {
              persist.push(
                prisma.oracleMessage.create({
                  data: {
                    userId,
                    sessionId,
                    role: "assistant",
                    content: outputText,
                    sources,
                  },
                })
              );
            }
            if (conversationHistory.length >= 4) {
              persist.push(
                updateReaderProfile(
                  userId,
                  setting?.oracleProfile,
                  trimmed,
                  outputText,
                  apiKey
                )
              );
            }
            persist.push(
              prisma.oracleSession.update({
                where: { id: sessionId },
                data: { mode },
              })
            );
            await Promise.all(persist);
          } catch (err) {
            console.error("[oracle] memory persist error:", err);
          }
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
    console.error("Erro em POST /api/oracle:", error);
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
