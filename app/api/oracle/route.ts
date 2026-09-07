import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";
import { normalize } from "@/lib/book-cover";
import { readJson } from "@/lib/validation";
import { z } from "zod";

const oracleSchema = z.object({
  question: z.string().nullish(),
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
    const { audio } = parsed.data;

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

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const [historyDesc, setting, , readingNow, weekLogs] = await Promise.all([
      prisma.oracleMessage.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      prisma.librarySetting.findUnique({ where: { userId } }),
      prisma.oracleMessage.create({
        data: { userId, role: "user", content: trimmed },
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
      { author: string; genre: string | null }[]
    >`SELECT DISTINCT author, genre FROM "Book" WHERE "userId" = ${userId}`;

    const hitAuthors = new Set<string>();
    const hitGenres = new Set<string>();
    for (const m of meta) {
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
    if (hitAuthors.size > 0 || hitGenres.size > 0) {
      const or: { author?: { in: string[] }; genre?: { in: string[] } }[] = [];
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
      contextBooks = [...relevantBooks, ...extra].slice(0, 8);
      console.log(
        `[oracle] Híbrido: autores=[${[...hitAuthors].join(", ")}] gêneros=[${[...hitGenres].join(", ")}] → +${extra.length} livros`
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

    const profile = setting?.oracleProfile?.trim();
    const systemPrompt = `Você é o Oráculo de uma biblioteca pessoal — um bibliotecário erudito e apaixonado por literatura, com o tom de um curador de uma biblioteca clássica. Você CONHECE este leitor: use o perfil e o histórico da conversa para personalizar respostas, retomar assuntos anteriores e fazer recomendações cada vez mais afinadas.

Duas situações distintas:
1. CONVERSA CASUAL — cumprimentos, small talk, perguntas sobre você ("como você está?", "obrigado", "bom dia", "quem é você?"): responda com naturalidade, calor e brevidade na persona do bibliotecário, e convide o leitor a explorar o acervo. NUNCA responda a uma saudação dizendo que "não há livros sobre isso" — isso seria robótico e sem sentido.
2. PERGUNTAS SOBRE LIVROS — recomendações, temas, autores, o que ler: responda usando APENAS os livros do acervo listados na mensagem do usuário — nunca mencione ou recomende livros que não estejam na lista. Seja elegante e cite os livros pelo título. Se a lista estiver vazia ou os livros não tiverem relação com a pergunta, admita com honestidade intelectual que o acervo não cobre o tema e sugira o que o leitor poderia explorar no que ele já tem.${
      profile ? `\n\nO que você já sabe sobre este leitor:\n${profile}` : ""
    }`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...historyDesc.reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: `Livros relevantes do acervo:\n${context}${progressSection ? `\n\nLeituras em andamento do usuário:\n${progressSection}` : ""}${weekSection}\n\nPergunta do usuário: ${trimmed}`,
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

        const sources = contextBooks.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
        }));
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

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [desc, books] = await Promise.all([
      prisma.oracleMessage.findMany({
        where: { userId },
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
    ]);

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
      JSON.stringify({ messages: desc.reverse(), suggestions }),
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
