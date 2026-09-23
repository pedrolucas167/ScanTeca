/**
 * Jev Reranking
 * 
 * Re-ranks retrieved books based on query context and relevance.
 * Discards irrelevant results before sending to LLM, saving tokens.
 * 
 * TODO: Substituir heurísticas por Jev API quando disponível
 */

export interface BookCandidate {
  id: string;
  title: string;
  author: string;
  publishedDate?: string | null;
  synopsis?: string | null;
  genre?: string | null;
  status?: string;
  rating?: number | null;
  distance?: number;
}

export interface RerankedResult {
  id: string;
  relevance: number;
  reason: string;
}

export interface RerankingOptions {
  mode?: "RECOMMEND" | "EXPLORE" | "COMPARE" | "JOURNEY" | "CURATE" | "LOCATE" | "ASSISTANT";
  threshold?: number;
  maxResults?: number;
}

/**
 * Rerank book candidates based on query and mode
 */
export async function jevRerank(
  query: string,
  candidates: BookCandidate[],
  options: RerankingOptions = {}
): Promise<RerankedResult[]> {
  const { mode = "EXPLORE", threshold = 0.3, maxResults = 6 } = options;
  
  if (candidates.length === 0) {
    return [];
  }

  // Score each candidate
  const scored = candidates.map((candidate) => {
    const score = calculateRelevance(query, candidate, mode);
    return {
      id: candidate.id,
      relevance: score.relevance,
      reason: score.reason,
    };
  });

  // Filter by threshold and sort by relevance
  const filtered = scored
    .filter((r) => r.relevance >= threshold)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxResults);

  return filtered;
}

/**
 * Calculate relevance score for a candidate
 */
function calculateRelevance(
  query: string,
  candidate: BookCandidate,
  mode: string
): { relevance: number; reason: string } {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = candidate.title.toLowerCase();
  const normalizedAuthor = candidate.author.toLowerCase();
  const normalizedGenre = candidate.genre?.toLowerCase() || "";
  const normalizedSynopsis = candidate.synopsis?.toLowerCase() || "";

  let score = 0;
  const reasons: string[] = [];

  // 1. Semantic similarity (from vector distance)
  if (candidate.distance !== undefined) {
    const semanticScore = Math.max(0, (1 - candidate.distance) * 100);
    score += semanticScore * 0.4; // 40% weight
    if (semanticScore > 70) {
      reasons.push("alta similaridade semântica");
    }
  }

  // 2. Title match
  if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    score += 30;
    reasons.push("título mencionado");
  }

  // 3. Author match
  const authorWords = normalizedAuthor.split(/\s+/);
  const queryWords = normalizedQuery.split(/\s+/);
  const authorMatch = authorWords.some((word) => 
    word.length > 3 && queryWords.includes(word)
  );
  if (authorMatch) {
    score += 25;
    reasons.push("autor mencionado");
  }

  // 4. Genre match
  if (normalizedGenre && normalizedQuery.includes(normalizedGenre)) {
    score += 20;
    reasons.push("gênero mencionado");
  }

  // 5. Synopsis keywords match
  const synopsisWords = normalizedSynopsis.split(/\s+/).filter((w) => w.length > 4);
  const synopsisMatches = synopsisWords.filter((word) => queryWords.includes(word));
  if (synopsisMatches.length >= 2) {
    score += 15;
    reasons.push("sinopse relacionada");
  }

  // 6. Rating boost
  if (candidate.rating && candidate.rating >= 4) {
    score += candidate.rating * 2;
    reasons.push(`avaliação ${candidate.rating}/5`);
  } else if (candidate.rating) {
    score += candidate.rating;
  }

  // 7. Mode-specific boosts
  if (mode === "JOURNEY" && candidate.status === "READING") {
    score += 25;
    reasons.push("livro sendo lido");
  } else if (mode === "RECOMMEND" && candidate.status === "TO_READ") {
    score += 15;
    reasons.push("na lista de leitura");
  } else if (mode === "RECOMMEND" && candidate.status === "READ" && (candidate.rating || 0) >= 4) {
    score += 20;
    reasons.push("livro bem avaliado");
  }

  // Normalize score to 0-100
  score = Math.min(100, score);

  return {
    relevance: score,
    reason: reasons.join(", ") || "correspondência geral",
  };
}

/**
 * Merge semantic and metadata results with reranking
 */
export async function mergeAndRerank(
  query: string,
  semanticResults: BookCandidate[],
  metadataResults: BookCandidate[],
  options: RerankingOptions = {}
): Promise<RerankedResult[]> {
  // Merge results, deduplicating by ID
  const merged = new Map<string, BookCandidate>();
  
  for (const result of semanticResults) {
    merged.set(result.id, { ...result, distance: result.distance || 0 });
  }
  
  for (const result of metadataResults) {
    const existing = merged.get(result.id);
    if (existing) {
      // Keep the lower distance (better semantic match)
      if (result.distance !== undefined && result.distance < (existing.distance || Infinity)) {
        merged.set(result.id, result);
      }
    } else {
      // Metadata-only result, set distance to 1 (no semantic match)
      merged.set(result.id, { ...result, distance: 1 });
    }
  }

  const candidates = Array.from(merged.values());
  return jevRerank(query, candidates, options);
}
