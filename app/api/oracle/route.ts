import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";
import { normalize } from "@/lib/book-cover";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";
import { z } from "zod";

const ORACLE_MODES = ["RECOMMEND", "EXPLORE", "COMPARE", "JOURNEY", "CURATE", "LOCATE"] as const;

const oracleSchema = z.object({
  question: z.string().nullish(),
  mode: z.enum(ORACLE_MODES).default("EXPLORE"),
  sessionId: z.string().cuid().nullish(),
  audio: z
    .object({
      data: z.string().nullish(),
      format: z.string().nullish(),
    })
    .nullish(),
});

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const CHAT_MODEL =
  process.env.ORACLE_CHAT_MODEL || "meta-llama/llama-3.1-8b-instruct";
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
}

const HISTORY_LIMIT = 12;
const DISTANCE_THRESHOLD = 0.6;

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
        max_tokens: 250,
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
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Reescreva a última pergunta do leitor como uma pergunta autossuficiente, incorporando títulos, autores e temas citados na conversa. Se já for autossuficiente, repita-a. Responda apenas com a pergunta reescrita.

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
    const { audio, mode, sessionId: requestedSessionId } = parsed.data;

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
    let sessionId = requestedSessionId ?? null;
    if (sessionId) {
      const ownsSession = await prisma.oracleSession.count({
        where: { id: sessionId, userId },
      });
      if (!ownsSession) {
        return Response.json({ error: "Conversa não encontrada" }, { status: 404 });
      }
    } else {
      const session = await prisma.oracleSession.create({
        data: {
          userId,
          title: trimmed.slice(0, 80),
          mode,
        },
      });
      sessionId = session.id;
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
      prisma.oracleMessage.create({
        data: { userId, sessionId, role: "user", content: trimmed },
      }),
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
        take: 12,
        select: {
          type: true,
          content: true,
          page: true,
          book: { select: { title: true, author: true } },
        },
      }),
    ]);

    const retrievalQuery = await contextualizeQuestion(
      trimmed,
      historyDesc,
      apiKey
    );
    const questionEmbedding = await generateEmbedding(retrievalQuery);

    if (!questionEmbedding) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar embedding da pergunta" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const vector = `[${questionEmbedding.join(",")}]`;
    const similarBooks = await prisma.$queryRaw<SimilarBook[]>`
      SELECT id, title, author, "publishedDate", synopsis, genre,
             status::text as status, rating,
             embedding <=> ${vector}::vector AS distance
      FROM "Book"
      WHERE "userId" = ${userId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vector}::vector
      LIMIT 5
    `;

    const relevantBooks = similarBooks.filter(
      (b) => Number(b.distance) < DISTANCE_THRESHOLD
    );

    console.log(
      "[oracle] Busca vetorial:",
      similarBooks
        .map((b) => `${b.title} (dist=${Number(b.distance).toFixed(4)})`)
        .join(", "),
      `→ ${relevantBooks.length} relevantes (< ${DISTANCE_THRESHOLD})`
    );

    const qWords = new Set(normalize(retrievalQuery));
    const qText = normalize(retrievalQuery).join(" ");
    const meta = await prisma.$queryRaw<
      { id: string; title: string; author: string; genre: string | null }[]
    >`SELECT id, title, author, genre FROM "Book" WHERE "userId" = ${userId}`;

    const hitBookIds = new Set<string>();
    const hitAuthors = new Set<string>();
    const hitGenres = new Set<string>();
    for (const m of meta) {
      const normalizedTitle = normalize(m.title).join(" ");
      if (normalizedTitle.length >= 4 && qText.includes(normalizedTitle)) {
        hitBookIds.add(m.id);
      }
      const authorWords = normalize(m.author).filter((w) => w.length >= 4);
      const surname = authorWords[authorWords.length - 1];
      if (
        (surname && qWords.has(surname)) ||
        (authorWords.length > 1 && authorWords.every((w) => qWords.has(w)))
      ) {
        hitAuthors.add(m.author);
      }
      if (m.genre) {
        const g = normalize(m.genre).join(" ");
        if (g && qText.includes(g)) hitGenres.add(m.genre);
      }
    }

    let contextBooks = relevantBooks;
    if (hitBookIds.size > 0 || hitAuthors.size > 0 || hitGenres.size > 0) {
      const or: {
        id?: { in: string[] };
        author?: { in: string[] };
        genre?: { in: string[] };
      }[] = [];
      if (hitBookIds.size > 0) or.push({ id: { in: [...hitBookIds] } });
      if (hitAuthors.size > 0) or.push({ author: { in: [...hitAuthors] } });
      if (hitGenres.size > 0) or.push({ genre: { in: [...hitGenres] } });
      const metaRows = await prisma.book.findMany({
        where: { userId, OR: or },
        take: 8,
      });
      const seen = new Set(relevantBooks.map((b) => b.id));
      const extra: SimilarBook[] = metaRows
        .filter((b) => !seen.has(b.id))
        .map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          publishedDate: b.publishedDate,
          synopsis: b.synopsis,
          genre: b.genre,
          status: String(b.status),
          rating: b.rating,
          distance: 0,
        }));
      contextBooks = [...relevantBooks, ...extra]
        .sort((a, b) => {
          const score = (book: SimilarBook) => {
            const distance = Number(book.distance);
            const semantic = distance > 0 ? (1 - distance) * 60 : 0;
            const title = hitBookIds.has(book.id) ? 100 : 0;
            const author = hitAuthors.has(book.author) ? 35 : 0;
            const genre = book.genre && hitGenres.has(book.genre) ? 20 : 0;
            const rating = (book.rating ?? 0) * 2;
            const status =
              mode === "JOURNEY" && book.status === "READING"
                ? 25
                : mode === "RECOMMEND" && book.status === "TO_READ"
                  ? 15
                  : 0;
            return semantic + title + author + genre + rating + status;
          };
          return score(b) - score(a);
        })
        .slice(0, 8);
      console.log(
        `[oracle] Híbrido: títulos=[${[...hitBookIds].join(", ")}] autores=[${[...hitAuthors].join(", ")}] gêneros=[${[...hitGenres].join(", ")}] → +${extra.length} livros`
      );
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

    const diarySection = diaryEntries.length
      ? `\n\nMemória recente do diário de leitura:\n${diaryEntries
          .map((entry) => `- [${entry.type}] "${entry.book.title}"${entry.page ? `, pág. ${entry.page}` : ""}: ${entry.content.slice(0, 500)}`)
          .join("\n")}`
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
    };
    const systemPrompt = `Você é o Oráculo de uma biblioteca pessoal — um bibliotecário erudito e apaixonado por literatura, com o tom de um curador de uma biblioteca clássica. Você CONHECE este leitor: use o perfil e o histórico da conversa para personalizar respostas, retomar assuntos anteriores e fazer recomendações cada vez mais afinadas.

Modo atual: ${mode}.
Instrução específica: ${modeInstructions[mode]}
${profile ? `\n\nO que você já sabe sobre este leitor:\n${profile}` : ""}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...historyDesc.reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `Livros relevantes do acervo:\n${context}${progressSection ? `\n\nLeituras em andamento do usuário:\n${progressSection}` : ""}${weekSection}${diarySection}\n\nPergunta do usuário: ${trimmed}`,
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

        const sources = contextBooks.map((b) => {
          const distance = Number(b.distance);
          const vectorMatch = distance > 0 && distance < DISTANCE_THRESHOLD;
          const relevance = vectorMatch
            ? Math.max(0, Math.min(100, Math.round((1 - distance) * 100)))
            : 100;
          const matchedBy = vectorMatch
            ? "similaridade semântica"
            : hitBookIds.has(b.id)
              ? "título mencionado"
              : hitAuthors.has(b.author)
                ? "autor mencionado"
                : b.genre && hitGenres.has(b.genre)
                  ? "gênero mencionado"
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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sessionId })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ transcript: trimmed })}\n\n`)
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`)
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;

              try {
                const json = JSON.parse(payload);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ text: delta })}\n\n`
                    )
                  );
                }
              } catch {
              }
            }
          }
        } finally {
          try {
            if (fullText.trim()) {
              await prisma.oracleMessage.create({
                data: {
                  userId,
                  sessionId,
                  role: "assistant",
                  content: fullText,
                  sources,
                },
              });
            }
            await updateReaderProfile(
              userId,
              setting?.oracleProfile,
              trimmed,
              fullText,
              apiKey
            );
            await prisma.oracleSession.update({
              where: { id: sessionId },
              data: { mode },
            });
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
