interface ModerationResult {
  approved: boolean;
  flagged: boolean;
  reason?: string;
  category?: "hate" | "violence" | "sexual" | "harassment" | "spam" | "other";
}

export async function moderateContent(content: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Se não tiver API key, aprova por padrão (modo degradado)
    console.warn("[moderation] OPENROUTER_API_KEY not configured, auto-approving");
    return { approved: true, flagged: false };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um moderador de conteúdo para uma rede social de leitores. Sua tarefa é analisar publicações e determinar se elas violam as diretrizes da comunidade.

Categorias de violação:
- HATE: Discurso de ódio, racismo, homofobia, xenofobia
- VIOLENCE: Ameaças, violência explícita, incentivo à violência
- SEXUAL: Conteúdo sexualmente explícito, pornografia
- HARASSMENT: Assédio, bullying, ataques pessoais
- SPAM: Spam, conteúdo repetitivo, autopromoção excessiva
- OTHER: Outras violações das diretrizes da comunidade

Responda APENAS em formato JSON com esta estrutura:
{
  "approved": boolean,
  "flagged": boolean,
  "reason": string (opcional, apenas se rejeitado ou flaggado),
  "category": string (opcional, uma das categorias acima)
}

Seja estrito mas justo. Conteúdo sobre livros, leitura e reflexões literárias devem ser aprovados.`
          },
          {
            role: "user",
            content: content
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("[moderation] API error:", response.status);
      return { approved: true, flagged: false }; // Fail-safe: aprova em caso de erro
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      approved: result.approved ?? true,
      flagged: result.flagged ?? false,
      reason: result.reason,
      category: result.category,
    };
  } catch (error) {
    console.error("[moderation] Error:", error);
    return { approved: true, flagged: false }; // Fail-safe: aprova em caso de erro
  }
}
