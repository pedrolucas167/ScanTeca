import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embeddings";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const CHAT_MODEL =
  process.env.ORACLE_CHAT_MODEL || "meta-llama/llama-3.1-8b-instruct";

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

    const { question } = (await request.json()) as { question?: string };
    if (!question || typeof question !== "string" || !question.trim()) {
      return new Response(
        JSON.stringify({ error: "Pergunta é obrigatória" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const questionEmbedding = await generateEmbedding(question.trim());
    if (!questionEmbedding) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar embedding da pergunta" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Vector similarity search (cosine distance) — no distance threshold,
    // always return the 5 closest books even if similarity is weak.
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

    console.log(
      "[oracle] Livros retornados pela busca vetorial:",
      similarBooks.map((b) => `${b.title} (dist=${Number(b.distance).toFixed(4)})`)
    );

    const context =
      similarBooks.length > 0
        ? similarBooks
            .map(
              (b, i) =>
                `${i + 1}. "${b.title}" — ${b.author}` +
                (b.publishedDate ? ` (${b.publishedDate})` : "") +
                (b.genre ? ` [${b.genre}]` : "") +
                `\n   Status: ${b.status === "READ" ? "Lido" : b.status === "TO_READ" ? "A ler" : "Desejo"}` +
                (b.rating ? ` | Avaliação: ${b.rating}/5` : "") +
                (b.synopsis ? `\n   Sinopse: ${b.synopsis.slice(0, 500)}` : "")
            )
            .join("\n\n")
        : "Nenhum livro relevante encontrado no acervo.";

    const prompt = `Você é um bibliotecário erudito e apaixonado por literatura, com o tom de um curador de uma biblioteca clássica. Responda à pergunta do usuário usando APENAS os seguintes livros do acervo pessoal dele. Seja elegante e cite os livros pelo título. Se os livros não forem suficientes para responder, diga isso com honestidade intelectual.

Livros relevantes do acervo:
${context}

Pergunta do usuário: ${question.trim()}`;

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
        messages: [{ role: "user", content: prompt }],
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

        const sources = similarBooks.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
        }));
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
