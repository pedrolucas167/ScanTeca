import type { Prisma } from "@prisma/client";

/**
 * Jev Metadata Filtering
 * 
 * Extrai filtros estruturados da query do usuário para busca no banco.
 * Substitui string matching manual por extração NLP mais precisa.
 * 
 * TODO: Substituir heurísticas por Jev API quando disponível
 */

export interface MetadataFilters {
  genre?: string | string[];
  author?: string;
  year?: number | { min?: number; max?: number };
  status?: "READ" | "READING" | "TO_READ" | "WISHLIST";
  rating_min?: number;
  rating_max?: number;
  title_contains?: string;
  collection?: string;
}

const GENRE_PATTERNS = [
  { pattern: /ficção científica|sci[- ]?fi|science fiction/i, genre: "Ficção Científica" },
  { pattern: /fantasia|fantasy/i, genre: "Fantasia" },
  { pattern: /terror|horror/i, genre: "Terror" },
  { pattern: /mistério|thriller|suspense/i, genre: "Mistério" },
  { pattern: /romance|romantic/i, genre: "Romance" },
  { pattern: /histórico|historical/i, genre: "Histórico" },
  { pattern: /biografia|biography/i, genre: "Biografia" },
  { pattern: /autoajuda|self[- ]?help/i, genre: "Autoajuda" },
  { pattern: /negócios|business/i, genre: "Negócios" },
  { pattern: /filosofia|philosophy/i, genre: "Filosofia" },
  { pattern: /poesia|poetry/i, genre: "Poesia" },
  { pattern: /conto|short story/i, genre: "Contos" },
  { pattern: /distopia|dystopia/i, genre: "Distopia" },
  { pattern: /aventura|adventure/i, genre: "Aventura" },
  { pattern: /crime|policial/i, genre: "Policial" },
  { pattern: /drama/i, genre: "Drama" },
  { pattern: /comédia|comedy/i, genre: "Comédia" },
  { pattern: /não[- ]?ficção|non[- ]?fiction/i, genre: "Não-ficção" },
  { pattern: /crônica|crônica/i, genre: "Crônica" },
  { pattern: /ensaio|essay/i, genre: "Ensaio" },
];

const AUTHOR_PATTERNS = [
  /escrito\s+por\s+([A-Za-z][A-Za-záàâãéèêíïóôõöúçñ\s\.]+)(?:\.|,|\s|$)/i,
  /por\s+([A-Za-z][A-Za-záàâãéèêíïóôõöúçñ\s\.]+)(?:\.|,|\s|$)/i,
  /do\s+([A-Za-z][A-Za-záàâãéèêíïóôõöúçñ\s\.]+)(?:\.|,|\s|$)/i,
];

/**
 * Extract metadata filters from query
 */
export async function jevExtractFilters(query: string): Promise<MetadataFilters> {
  const filters: MetadataFilters = {};
  const trimmed = query.trim().toLowerCase();

  // Extract genre
  const genre = extractGenre(trimmed);
  if (genre) {
    filters.genre = genre;
  }

  // Extract author
  const author = extractAuthor(query);
  if (author) {
    filters.author = author;
  }

  // Extract year or year range
  const year = extractYear(trimmed);
  if (year) {
    filters.year = year;
  }

  // Extract status
  const status = extractStatus(trimmed);
  if (status) {
    filters.status = status;
  }

  // Extract rating
  const rating = extractRating(trimmed);
  if (rating) {
    filters.rating_min = rating.min;
    filters.rating_max = rating.max;
  }

  // Extract title keywords
  const titleKeywords = extractTitleKeywords(trimmed);
  if (titleKeywords) {
    filters.title_contains = titleKeywords;
  }

  // Extract collection
  const collection = extractCollection(trimmed);
  if (collection) {
    filters.collection = collection;
  }

  return filters;
}

/**
 * Extract genre from query
 */
function extractGenre(query: string): string | null {
  for (const { pattern, genre } of GENRE_PATTERNS) {
    if (pattern.test(query)) {
      return genre;
    }
  }
  return null;
}

/**
 * Extract author name from query
 */
function extractAuthor(query: string): string | null {
  const commonWords = ["agora", "hoje", "amanhã", "ontem", "sempre", "nunca", "talvez", "talvez"];
  
  for (const pattern of AUTHOR_PATTERNS) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const author = match[1].trim();
      // Basic validation: should have at least 2 chars and not be a common word
      if (author.length > 2 && !commonWords.includes(author.toLowerCase())) {
        return author;
      }
    }
  }
  return null;
}

/**
 * Extract year or year range from query
 */
function extractYear(query: string): number | { min?: number; max?: number } | null {
  // Year ranges (check before specific year to avoid conflicts)
  if (/anos? (19|20)\d{0,2}s?|década de (19|20)\d{0,2}/i.test(query)) {
    const decadeMatch = query.match(/(19|20)\d{2}/);
    if (decadeMatch) {
      const decade = parseInt(decadeMatch[0]);
      return { min: decade, max: decade + 9 };
    }
  }

  // Specific year
  const yearMatch = query.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }

  // Relative ranges
  if (/anos? (60|70|80|90|00|10|20|30)/i.test(query)) {
    const decadeMatch = query.match(/(60|70|80|90|00|10|20|30)/);
    if (decadeMatch) {
      const decade = parseInt(decadeMatch[0]);
      const fullDecade = decade < 50 ? 2000 + decade : 1900 + decade;
      return { min: fullDecade, max: fullDecade + 9 };
    }
  }

  // Antigo/Moderno
  if (/antigo|século (XIX|XVIII|XVII|XVI)/i.test(query)) {
    return { min: 0, max: 1950 };
  }

  if (/moderno|contemporâneo|recente|atual/i.test(query)) {
    return { min: 2000 };
  }

  return null;
}

/**
 * Extract reading status from query
 */
function extractStatus(query: string): "READ" | "READING" | "TO_READ" | "WISHLIST" | null {
  if (/lido|terminado|concluído|finalizado|acabei|já li/i.test(query)) {
    return "READ";
  }
  if (/lendo|atual|em andamento|lendo agora|no momento/i.test(query)) {
    return "READING";
  }
  if (/quero ler|pretendo ler|a ler|para ler|vou ler/i.test(query)) {
    return "TO_READ";
  }
  if (/desejo|lista de desejo|wishlist|quero ter/i.test(query)) {
    return "WISHLIST";
  }
  return null;
}

/**
 * Extract rating range from query
 */
function extractRating(query: string): { min: number; max?: number } | null {
  // Exact rating
  const exactMatch = query.match(/(\d)\s*(estrela|nota|\/5)/i);
  if (exactMatch) {
    const rating = parseInt(exactMatch[1]);
    return { min: rating, max: rating };
  }

  // Rating ranges
  if (/alta|excelente|incrível|perfeito|5 estrelas/i.test(query)) {
    return { min: 5 };
  }
  if (/boa|ótima|4 estrelas|mais de 4/i.test(query)) {
    return { min: 4 };
  }
  if (/razoável|ok|3 estrelas|pelo menos 3/i.test(query)) {
    return { min: 3 };
  }
  if (/baixa|fraca|menos de 3|abaixo de 3/i.test(query)) {
    return { min: 0, max: 2 };
  }

  return null;
}

/**
 * Extract title keywords from query
 */
function extractTitleKeywords(query: string): string | null {
  // Look for quoted strings
  const quotedMatch = query.match(/"([^"]+)"/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Look for capitalized words that might be title parts
  const words = query.split(/\s+/);
  const titleWords = words.filter(w => /^[A-Z][a-z]/.test(w) && w.length > 3);
  
  if (titleWords.length >= 2) {
    return titleWords.join(" ");
  }

  return null;
}

/**
 * Extract collection name from query
 */
function extractCollection(query: string): string | null {
  const collectionMatch = query.match(/(?:coleção|coleçao|pasta|lista)\s+(?:["']?)([^"'\s,]+(?:\s+[^"'\s,]+)*)/i);
  if (collectionMatch) {
    return collectionMatch[1].trim();
  }
  return null;
}

/**
 * Convert filters to Prisma where clause
 */
export function filtersToWhereClause(filters: MetadataFilters, userId: string): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = { userId };

  if (filters.genre) {
    if (Array.isArray(filters.genre)) {
      where.genre = { in: filters.genre };
    } else {
      where.genre = { contains: filters.genre, mode: "insensitive" };
    }
  }

  if (filters.author) {
    where.author = { contains: filters.author, mode: "insensitive" };
  }

  if (filters.year) {
    if (typeof filters.year === "number") {
      where.publishedDate = { startsWith: filters.year.toString() };
    } else {
      const dateConditions: Prisma.BookWhereInput[] = [];
      if (filters.year.min !== undefined) {
        dateConditions.push({ publishedDate: { gte: `${filters.year.min}-01-01` } });
      }
      if (filters.year.max !== undefined) {
        dateConditions.push({ publishedDate: { lte: `${filters.year.max}-12-31` } });
      }
      if (dateConditions.length > 0) {
        where.OR = dateConditions;
      }
    }
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.rating_min !== undefined || filters.rating_max !== undefined) {
    const ratingFilter: Prisma.IntNullableFilter = {};
    if (filters.rating_min !== undefined) {
      ratingFilter.gte = filters.rating_min;
    }
    if (filters.rating_max !== undefined) {
      ratingFilter.lte = filters.rating_max;
    }
    where.rating = ratingFilter;
  }

  if (filters.title_contains) {
    where.title = { contains: filters.title_contains, mode: "insensitive" };
  }

  if (filters.collection) {
    where.collection = {
      name: { contains: filters.collection, mode: "insensitive" },
    };
  }

  return where;
}
