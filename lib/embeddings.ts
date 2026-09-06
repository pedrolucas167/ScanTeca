const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[embeddings] OPENROUTER_API_KEY não configurada");
    return null;
  }

  const input = text.trim().slice(0, 8000); // limite seguro
  if (!input) return null;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[embeddings] OpenRouter error:", res.status, err);
      return null;
    }

    const data = await res.json();
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) return null;
    return embedding as number[];
  } catch (err) {
    console.error("[embeddings] fetch error:", err);
    return null;
  }
}

export function bookToEmbeddingText(book: {
  title: string;
  author: string;
  synopsis?: string | null;
  genre?: string | null;
  notes?: string | null;
  rating?: number | null;
}): string {
  return [
    book.title,
    book.author,
    book.genre ?? "",
    book.synopsis ?? "",
    book.rating ? `Avaliação do leitor: ${book.rating}/5` : "",
    book.notes ? `Notas do leitor: ${book.notes}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
}
