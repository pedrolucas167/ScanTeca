import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jevExtractFilters, filtersToWhereClause } from "@/lib/jev-filtering";
import type { OracleMode } from "@/lib/constants/oracle";

export interface OracleBook {
  id: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  genre: string | null;
  status: string;
  rating: number | null;
  distance?: number;
  relevance?: number;
  matchedBy?: string;
}

export const VECTOR_CANDIDATE_LIMIT = 24;
const CONTEXT_LIMIT = 6;
const STOP_WORDS = new Set("quais qual livros livro sobre para como uma uns das dos que meu minha seus suas quero ler recomendar recomende compare comparar entre com por autor autora escrito obras obra tem tenho voce pode acervo biblioteca".split(" "));
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function searchTerms(query: string): string[] {
  return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(word => word.length >= 3 && !STOP_WORDS.has(normalize(word))))].slice(0, 12);
}

/** Rank only candidates already authorized and checked against the requested filters. */
export function rankBooks(query: string, candidates: OracleBook[], filteredIds: Set<string> = new Set(), mode: OracleMode = "EXPLORE"): OracleBook[] {
  const normalizedQuery = ` ${normalize(query).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  const terms = searchTerms(query).map(normalize);
  const unique = new Map(candidates.map(book => [book.id, book]));
  return [...unique.values()].flatMap(book => {
    const title = normalize(book.title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const author = normalize(book.author).split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 3);
    const exactTitle = title.length > 1 && normalizedQuery.includes(` ${title} `);
    const authorMatch = author.some(word => terms.includes(word));
    const words = new Set(normalize(`${book.title} ${book.author} ${book.genre ?? ""} ${book.synopsis ?? ""}`).match(/[\p{L}\p{N}]+/gu));
    const overlap = terms.filter(term => words.has(term)).length;
    const semantic = book.distance !== undefined && Number.isFinite(Number(book.distance)) && Number(book.distance) < 0.7;
    const metadata = filteredIds.has(book.id);
    if (!exactTitle && !authorMatch && !overlap && !semantic && !metadata) return [];
    const modeBoost = mode === "JOURNEY" && book.status === "READING" ? 15
      : mode === "RECOMMEND" && (book.status === "TO_READ" || (book.status === "READ" && (book.rating ?? 0) >= 4)) ? 10 : 0;
    const relevance = Math.min(100, (exactTitle ? 70 : 0) + (authorMatch ? 40 : 0) +
      Math.min(30, overlap * 10) + (semantic ? (1 - Number(book.distance)) * 35 : 0) + (metadata ? 35 : 0) + modeBoost);
    const matchedBy = [exactTitle ? "título mencionado" : null, authorMatch ? "autor mencionado" : null,
      metadata ? "filtros de metadados" : null, semantic ? "similaridade semântica" : null,
      overlap && !exactTitle && !authorMatch ? "termos do acervo" : null].filter(Boolean).join(" · ");
    return [{ ...book, relevance: Math.round(relevance), matchedBy }];
  }).sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0) || a.id.localeCompare(b.id)).slice(0, CONTEXT_LIMIT);
}

export async function retrieveBooks(userId: string, query: string, semanticBooks: OracleBook[], mode: OracleMode = "EXPLORE") {
  const filters = await jevExtractFilters(query);
  // Two quoted titles describe a comparison, rather than a single mandatory title.
  if ([...query.matchAll(/"([^"]+)"/g)].length > 1) delete filters.title_contains;
  const where = filtersToWhereClause(filters, userId);
  const hasFilters = Object.keys(filters).length > 0;
  const terms = searchTerms(query);
  const select = { id: true, title: true, author: true, publishedDate: true, synopsis: true,
    genre: true, status: true, rating: true } as const;
  const lexical: Prisma.BookWhereInput[] = terms.flatMap(term => [
    { title: { contains: term, mode: "insensitive" as const } },
    { author: { contains: term, mode: "insensitive" as const } },
    { genre: { contains: term, mode: "insensitive" as const } },
  ]);
  const [matches, eligibleSemantic] = await Promise.all([
    hasFilters || lexical.length ? prisma.book.findMany({
      where: hasFilters ? where : { userId, OR: lexical }, select,
      orderBy: { id: "asc" }, take: VECTOR_CANDIDATE_LIMIT,
    }) : Promise.resolve([]),
    hasFilters && semanticBooks.length ? prisma.book.findMany({
      where: { AND: [where, { id: { in: semanticBooks.map(book => book.id) } }] }, select,
      orderBy: { id: "asc" }, take: VECTOR_CANDIDATE_LIMIT,
    }) : Promise.resolve(semanticBooks),
  ]);
  const distances = new Map(semanticBooks.map(book => [book.id, book.distance]));
  const candidates = [...matches, ...eligibleSemantic].map(book => ({ ...book, distance: distances.get(book.id) }));
  return { books: rankBooks(query, candidates, hasFilters ? new Set(candidates.map(book => book.id)) : undefined, mode),
    metadataCandidates: hasFilters ? matches.length : 0, lexicalCandidates: hasFilters ? 0 : matches.length };
}
