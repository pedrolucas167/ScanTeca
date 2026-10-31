import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { parseOracleUsage, type OracleUsage } from "@/lib/oracle-usage";
import { OPENROUTER_BASE, CHAT_MODEL, MAX_TOKENS_REWRITE } from "./config";

export async function contextualizeQuestion(
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
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return question;
    }
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

