import { prisma } from "./prisma";
import { generateEmbedding } from "./embeddings";
import { fetchWithRetry } from "./fetch-with-retry";
import {
  cleanTitle,
  normalize,
  normalizeAuthor,
  isBookSimilar,
  isUnknownAuthor,
} from "./book-metadata";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const CHAT_MODEL =
  process.env.ORACLE_CHAT_MODEL || "meta-llama/llama-3.1-8b-instruct";

export interface BookForClient {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  genre: string | null;
  pages: number | null;
  status: string;
  synopsis: string | null;
  createdAt: Date;
}

export interface AffinityNode {
  label: string;
  score: number;
  color: "primary" | "tertiary" | "secondary" | "outline";
}

export interface PrimaryRecommendation {
  id: string;
  title: string;
  author: string;
  cover: string;
  edition: string;
  pages: number;
  spine: number;
  compat: number;
  predictedRating: number;
  ragQuote: string;
  similarity: number;
  vectorId: string;
}

export interface Recommendation {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  score: number;
  quote: string;
  rating: number;
  tags: string[];
}

export interface RecommendationProfile {
  affinity: AffinityNode[];
  feedbackCount: number;
  recommendationFeedbackCount: number;
  calibration: number;
}

export interface RecommendationsPayload {
  primary: PrimaryRecommendation | null;
  queue: Recommendation[];
  profile: RecommendationProfile;
  books: BookForClient[];
}

interface RawBook {
  id: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  genre: string | null;
  notes: string | null;
  rating: number | null;
  status: string;
  coverUrl: string | null;
  pages: number | null;
  embeddingText: string | null;
}

interface GoogleBooksItem {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "ate",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "entao",
  "essa",
  "esse",
  "esta",
  "este",
  "eu",
  "ha",
  "isso",
  "ja",
  "la",
  "mas",
  "me",
  "mesmo",
  "mim",
  "minha",
  "meu",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "pela",
  "pelas",
  "pelo",
  "pelos",
  "por",
  "porem",
  "porque",
  "quando",
  "que",
  "quem",
  "se",
  "sem",
  "ser",
  "seu",
  "sua",
  "so",
  "sobre",
  "tambem",
  "te",
  "tem",
  "tendo",
  "ter",
  "teu",
  "tinha",
  "toda",
  "todas",
  "todo",
  "todos",
  "tu",
  "um",
  "uma",
  "você",
  "voce",
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "como",
  "com",
  "dos",
]);

function parseVector(text: string | null | undefined): number[] | null {
  if (!text) return null;
  const inner = text.replace(/^\[|\]$/g, "").trim();
  if (!inner) return [];
  const nums = inner
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n));
  return nums.length > 0 ? nums : null;
}

function averageVectors(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const avg = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) avg[i] += v[i];
  }
  return avg.map((s) => s / vectors.length);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    a2 += a[i] * a[i];
    b2 += b[i] * b[i];
  }
  if (a2 === 0 || b2 === 0) return 0;
  return dot / (Math.sqrt(a2) * Math.sqrt(b2));
}

function countFrequencies(items: (string | null | undefined)[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    const key = item.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function extractKeywords(
  texts: (string | null | undefined)[]
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    for (const word of normalize(text)) {
      if (STOP_WORDS.has(word)) continue;
      if (word.length <= 3) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .filter((e) => e.count > 1)
    .sort((a, b) => b.count - a.count);
}

function assignColor(score: number): AffinityNode["color"] {
  if (score >= 0.95) return "primary";
  if (score >= 0.9) return "tertiary";
  if (score >= 0.85) return "secondary";
  return "outline";
}

function buildSpineEstimate(pages: number | null): number {
  if (!pages || pages <= 0) return 1.4;
  return Math.round((pages / 140) * 10) / 10;
}

function estimatedRating(score: number): number {
  const rating = 3.4 + score * 1.5;
  return Math.round(Math.min(5, Math.max(3.2, rating)) * 10) / 10;
}

function googleBookCover(item: GoogleBooksItem): string | null {
  const links = item.volumeInfo.imageLinks;
  const url = links?.thumbnail ?? links?.smallThumbnail ?? null;
  if (!url) return null;
  let u = url.trim();
  if (u.startsWith("http:")) u = `https${u.slice(4)}`;
  if (u.includes("books.google.com")) {
    u = u.replace(/([?&])zoom=1\b/, "$1zoom=0");
  }
  return u;
}

function googleBookEdition(item: GoogleBooksItem): string {
  const info = item.volumeInfo;
  if (info.publishedDate && info.pageCount) {
    return `Edição ${info.publishedDate} • ${info.pageCount} págs`;
  }
  if (info.publishedDate) return `Edição ${info.publishedDate}`;
  if (info.pageCount) return `${info.pageCount} págs`;
  return "Edição padrão";
}

async function searchGoogleBooks(query: string): Promise<GoogleBooksItem[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const q = encodeURIComponent(query);
  const makeUrl = (lang: string) =>
    apiKey
      ? `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=12${lang}&key=${apiKey}`
      : `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=12${lang}`;

  const ptRes = await fetchWithRetry(makeUrl("&langRestrict=pt"), {
    maxRetries: 2,
    baseDelay: 500,
  });
  let data: { items?: GoogleBooksItem[] } = {};
  if (ptRes.ok) {
    data = (await ptRes.json()) as typeof data;
    if (!data.items || data.items.length === 0) {
      const fallbackRes = await fetchWithRetry(makeUrl(""), {
        maxRetries: 2,
        baseDelay: 500,
      });
      if (fallbackRes.ok) {
        data = (await fallbackRes.json()) as typeof data;
      }
    }
  }
  return data.items || [];
}

function scoreByOverlap(
  candidate: GoogleBooksItem,
  topGenres: { label: string; count: number }[],
  topAuthors: { label: string; count: number }[],
  topKeywords: { label: string; count: number }[],
  existingBooks: RawBook[]
): number {
  const info = candidate.volumeInfo;
  const title = cleanTitle(info.title) || "";
  const author = normalizeAuthor(info.authors?.join(", ")) || "";
  const description = info.description || "";
  const categories = info.categories || [];
  const text = normalize(`${title} ${author} ${description} ${categories.join(" ")}`);
  const textSet = new Set(text);

  let score = 0;
  const totalBooks = existingBooks.length || 1;

  for (const g of topGenres.slice(0, 3)) {
    if (categories.some((c) => c.toLowerCase().includes(g.label.toLowerCase()))) {
      score += g.count / totalBooks;
    }
  }

  for (const a of topAuthors.slice(0, 3)) {
    if (author.toLowerCase().includes(a.label.toLowerCase())) {
      score += a.count / totalBooks;
    }
  }

  const matchedKeywords = topKeywords.slice(0, 10).filter((k) => textSet.has(k.label));
  if (matchedKeywords.length > 0) {
    score += matchedKeywords.reduce((s, k) => s + k.count / totalBooks, 0) * 0.5;
  }

  // Penaliza autor que já está muito presente para evitar repetir a mesma obra
  const existingSameAuthor = existingBooks.filter((b) =>
    b.author.toLowerCase().includes(author.toLowerCase())
  ).length;
  if (existingSameAuthor > 2) score *= 0.8;

  return Math.min(0.99, score);
}

interface FeedbackProfile {
  dismissed: Set<string>;
  wanted: Set<string>;
  dismissedWordCounts: Map<string, number>;
  wantedWordCounts: Map<string, number>;
}

function feedbackKey(normalizedTitle: string, normalizedAuthor: string): string {
  return `${normalizedTitle}::${normalizedAuthor}`;
}

function buildFeedbackProfile(
  feedbackList: { kind: string; normalizedTitle: string; normalizedAuthor: string }[]
): FeedbackProfile {
  const dismissed = new Set<string>();
  const wanted = new Set<string>();
  const dismissedWordCounts = new Map<string, number>();
  const wantedWordCounts = new Map<string, number>();

  for (const f of feedbackList) {
    const key = feedbackKey(f.normalizedTitle, f.normalizedAuthor);
    if (f.kind === "DISMISSED") dismissed.add(key);
    if (f.kind === "WANT") wanted.add(key);

    const counts = f.kind === "DISMISSED" ? dismissedWordCounts : wantedWordCounts;
    for (const word of f.normalizedTitle.split(" ")) {
      if (word.length > 2) counts.set(word, (counts.get(word) || 0) + 1);
    }
    for (const word of f.normalizedAuthor.split(" ")) {
      if (word.length > 2) counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return { dismissed, wanted, dismissedWordCounts, wantedWordCounts };
}

function isFeedbackDismissed(
  title: string,
  author: string,
  feedback: FeedbackProfile
): boolean {
  const normalizedTitle = normalize(title).join(" ");
  const normalizedAuthor = normalize(author).join(" ");
  return feedback.dismissed.has(feedbackKey(normalizedTitle, normalizedAuthor));
}

function feedbackScoreAdjustment(
  title: string,
  author: string,
  feedback: FeedbackProfile
): number {
  const normalizedTitle = normalize(title).join(" ");
  const normalizedAuthor = normalize(author).join(" ");
  const key = feedbackKey(normalizedTitle, normalizedAuthor);

  if (feedback.dismissed.has(key) || feedback.wanted.has(key)) return -1;

  const words = new Set([
    ...normalizedTitle.split(" ").filter((w) => w.length > 2),
    ...normalizedAuthor.split(" ").filter((w) => w.length > 2),
  ]);

  let boost = 0;
  for (const word of words) {
    if (feedback.wantedWordCounts.has(word)) {
      boost += 0.02 * Math.min(3, feedback.wantedWordCounts.get(word) || 0);
    }
    if (feedback.dismissedWordCounts.has(word)) {
      boost -= 0.015 * Math.min(3, feedback.dismissedWordCounts.get(word) || 0);
    }
  }

  return Math.max(-0.5, Math.min(0.3, boost));
}

function buildRagQuote(
  candidateTitle: string,
  candidateAuthor: string,
  topAffinity: string,
  similarBook: RawBook | null
): string {
  if (similarBook) {
    return `Conexão identificada: ${candidateTitle} dialoga com as ideias de "${similarBook.title}" — ${similarBook.author} — e aprofunda o seu interesse por ${topAffinity}.`;
  }
  return `Conexão identificada: ${candidateTitle}, de ${candidateAuthor}, segue na trilha de ${topAffinity} que você tem explorado no acervo.`;
}

function findMostSimilarBook(
  candidate: GoogleBooksItem,
  existingBooks: RawBook[],
  existingVectors: Map<string, number[]>,
  profileVector: number[] | null
): { book: RawBook | null; similarity: number } {
  const info = candidate.volumeInfo;
  const title = cleanTitle(info.title) || "";
  const author = normalizeAuthor(info.authors?.join(", ")) || "";
  const description = info.description || "";
  const candidateText = `${title} ${author} ${description} ${(info.categories || []).join(" ")}`;
  const candidateWords = new Set(normalize(candidateText));

  let bestBook: RawBook | null = null;
  let bestScore = 0;

  for (const book of existingBooks) {
    let score = 0;
    if (profileVector && existingVectors.has(book.id)) {
      // Palpites heurísticos + vetorial quando disponível
      const v = existingVectors.get(book.id)!;
      // candidate ainda não tem vetor, então usamos o embedding do livro
      // do acervo como proxy de proximidade do perfil
      score += cosineSimilarity(profileVector, v) * 0.6;
    }

    const bookText = `${book.title} ${book.author} ${book.synopsis || ""} ${book.genre || ""}`;
    const bookWords = new Set(normalize(bookText));
    const common = [...candidateWords].filter((w) => bookWords.has(w)).length;
    score += (common / Math.max(candidateWords.size, 1)) * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestBook = book;
    }
  }

  return { book: bestBook, similarity: bestScore };
}

async function generateLLMSuggestions(
  books: RawBook[],
  topGenres: { label: string; count: number }[],
  topAuthors: { label: string; count: number }[],
  topKeywords: { label: string; count: number }[]
): Promise<{ title: string; author: string; reason: string; tags: string[] }[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  const bookList = books
    .slice(0, 8)
    .map(
      (b) =>
        `- "${b.title}" — ${b.author}${b.genre ? ` [${b.genre}]` : ""}${b.rating ? ` (nota ${b.rating}/5)` : ""}${b.synopsis ? ` | ${b.synopsis.slice(0, 180)}` : ""}`
    )
    .join("\n");

  const prompt = `Você é o Oráculo de uma biblioteca pessoal. Analise o acervo abaixo e sugira 5 livros que o leitor provavelmente gostaria de ler, mas que provavelmente NÃO estão na lista. Responda APENAS com JSON no formato: [{"title": "...", "author": "...", "reason": "...", "tags": ["..."]}].

Acervo do leitor:
${bookList}

Tendências principais: gêneros: ${topGenres.map((g) => g.label).join(", ")}; autores: ${topAuthors.map((a) => a.label).join(", ")}; temas: ${topKeywords.slice(0, 6).map((k) => k.label).join(", ")}.`;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Scanteca Descobrir",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: false,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      author: string;
      reason: string;
      tags: string[];
    }[];

    return (Array.isArray(parsed) ? parsed : []).filter((s) => s.title && s.author);
  } catch (err) {
    console.error("[recommendations] LLM suggestions error:", err);
    return [];
  }
}

async function enrichWithGoogleBooks(
  suggestions: { title: string; author: string; reason: string; tags: string[] }[]
): Promise<GoogleBooksItem[]> {
  const results: GoogleBooksItem[] = [];
  for (const s of suggestions) {
    const query = `intitle:${s.title} inauthor:${s.author}`;
    const items = await searchGoogleBooks(query);
    const best =
      items.find((i) =>
        isBookSimilar(
          s.title,
          s.author,
          i.volumeInfo.title || "",
          i.volumeInfo.authors?.join(", ") || ""
        )
      ) || items[0];
    if (best) results.push(best);
  }
  return results;
}

async function fetchCandidatesFromProfile(
  topGenres: { label: string; count: number }[],
  topAuthors: { label: string; count: number }[],
  topKeywords: { label: string; count: number }[]
): Promise<GoogleBooksItem[]> {
  const queries: string[] = [];
  for (const g of topGenres.slice(0, 2)) {
    for (const a of topAuthors.slice(0, 2)) {
      queries.push(`subject:${g.label} inauthor:"${a.label}"`);
    }
  }
  for (const k of topKeywords.slice(0, 3)) {
    queries.push(k.label);
  }
  if (queries.length === 0) {
    for (const g of topGenres.slice(0, 3)) {
      queries.push(`subject:${g.label}`);
    }
    for (const a of topAuthors.slice(0, 2)) {
      queries.push(`inauthor:"${a.label}"`);
    }
  }

  const all: GoogleBooksItem[] = [];
  for (const q of queries.slice(0, 4)) {
    const items = await searchGoogleBooks(q);
    all.push(...items);
  }
  return all;
}

export async function buildRecommendations(
  userId: string
): Promise<RecommendationsPayload> {
  const booksRaw = await prisma.$queryRaw<RawBook[]>`
    SELECT id, title, author, "publishedDate", synopsis, genre, notes, rating, status::text as status,
           "coverUrl", pages, embedding::text as "embeddingText"
    FROM "Book"
    WHERE "userId" = ${userId}
    ORDER BY updated_at DESC
  `;

  const [diaryCount, reviewCount, ratingCount, feedbackList] = await Promise.all([
    prisma.diaryEntry.count({ where: { userId } }),
    prisma.review.count({ where: { userId } }),
    prisma.book.count({ where: { userId, rating: { not: null } } }),
    prisma.recommendationFeedback.findMany({
      where: { userId },
      select: {
        kind: true,
        normalizedTitle: true,
        normalizedAuthor: true,
      },
    }),
  ]);

  const feedback = buildFeedbackProfile(feedbackList);

  const books: BookForClient[] = booksRaw.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverUrl: b.coverUrl,
    genre: b.genre,
    pages: b.pages,
    status: b.status,
    synopsis: b.synopsis,
    createdAt: new Date(),
  }));

  if (booksRaw.length === 0) {
    return {
      primary: null,
      queue: [],
      profile: {
        affinity: [],
        feedbackCount: 0,
        recommendationFeedbackCount: 0,
        calibration: 0,
      },
      books,
    };
  }

  const genreFreq = countFrequencies(booksRaw.map((b) => b.genre));
  const authorFreq = countFrequencies(booksRaw.map((b) => b.author));
  const keywordFreq = extractKeywords([
    ...booksRaw.map((b) => `${b.title} ${b.synopsis || ""} ${b.genre || ""}`),
  ]);

  const totalBooks = booksRaw.length;
  const combined: { label: string; count: number }[] = [
    ...genreFreq,
    ...authorFreq,
    ...keywordFreq,
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const affinity: AffinityNode[] = combined.slice(0, 4).map((item) => ({
    label: item.label,
    score: Math.min(0.99, item.count / totalBooks),
    color: assignColor(item.count / totalBooks),
  }));

  const feedbackCount = diaryCount + reviewCount + ratingCount;
  const recommendationFeedbackCount = feedbackList.length;
  const indexedCount = booksRaw.filter((b) => b.embeddingText && b.embeddingText !== "[]").length;
  const calibration = Math.min(
    99,
    Math.round(
      30 +
        totalBooks * 2.5 +
        indexedCount * 1.5 +
        feedbackCount * 0.3 +
        recommendationFeedbackCount * 0.6
    )
  );

  const topGenre = genreFreq[0]?.label || keywordFreq[0]?.label || "Literatura";
  const topAffinity = affinity[0]?.label || topGenre;

  // Vetor de perfil (média dos embeddings existentes)
  const existingVectors = new Map<string, number[]>();
  const allVectors: number[][] = [];
  for (const b of booksRaw) {
    const v = parseVector(b.embeddingText);
    if (v && v.length > 0) {
      existingVectors.set(b.id, v);
      allVectors.push(v);
    }
  }
  const profileVector = allVectors.length > 0 ? averageVectors(allVectors) : null;

  // Geração de candidatos
  const llmSuggestions = await generateLLMSuggestions(
    booksRaw,
    genreFreq,
    authorFreq,
    keywordFreq
  );

  const llmCandidates =
    llmSuggestions.length > 0
      ? await enrichWithGoogleBooks(llmSuggestions)
      : [];

  const searchCandidates = await fetchCandidatesFromProfile(
    genreFreq,
    authorFreq,
    keywordFreq
  );

  const allCandidates = [...llmCandidates, ...searchCandidates];

  // Deduplica e filtra livros já existentes no acervo
  const seen = new Set<string>();
  const uniqueCandidates: GoogleBooksItem[] = [];
  for (const item of allCandidates) {
    const title = cleanTitle(item.volumeInfo.title) || "";
    const author = normalizeAuthor(item.volumeInfo.authors?.join(", ")) || "";
    if (!title || isUnknownAuthor(author)) continue;

    const alreadyInLibrary = booksRaw.some((b) =>
      isBookSimilar(title, author, b.title, b.author)
    );
    if (alreadyInLibrary) continue;

    if (isFeedbackDismissed(title, author, feedback)) continue;

    const key = `${normalize(title).join(" ")}::${normalize(author).join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCandidates.push(item);
  }

  if (uniqueCandidates.length === 0) {
    return {
      primary: null,
      queue: [],
      profile: {
        affinity,
        feedbackCount,
        recommendationFeedbackCount,
        calibration,
      },
      books,
    };
  }

  // Se tiver vetor de perfil, gera vetores dos candidatos para ranquear semanticamente
  let ranked = uniqueCandidates.map((item) => {
    const info = item.volumeInfo;
    const title = cleanTitle(info.title) || "";
    const author = normalizeAuthor(info.authors?.join(", ")) || "";
    const description = info.description || "";
    const text = `${title}. ${author}. ${description}. ${(info.categories || []).join(" ")}`;

    const baseScore = scoreByOverlap(item, genreFreq, authorFreq, keywordFreq, booksRaw);
    const adjustment = feedbackScoreAdjustment(title, author, feedback);

    return {
      item,
      title,
      author,
      text,
      score: Math.min(0.99, Math.max(0, baseScore + adjustment)),
      tags: info.categories?.slice(0, 2).map((c) => c.split("/").pop() || c) || [],
    };
  });

  if (profileVector) {
    const candidateEmbeddings = await Promise.all(
      ranked.map(async (r) => {
        const emb = await generateEmbedding(r.text.slice(0, 600));
        return emb && emb.length > 0 ? emb : null;
      })
    );

    ranked = ranked.map((r, i) => {
      const emb = candidateEmbeddings[i];
      const vectorScore = emb ? cosineSimilarity(profileVector, emb) : r.score * 0.5;
      return { ...r, score: Math.min(0.99, r.score * 0.3 + vectorScore * 0.7) };
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  const topRanked = ranked.slice(0, 4);

  const queue: Recommendation[] = [];
  let primary: PrimaryRecommendation | null = null;

  for (let i = 0; i < topRanked.length; i++) {
    const r = topRanked[i];
    const info = r.item.volumeInfo;
    const cover = googleBookCover(r.item);
    const pages = info.pageCount || 0;
    const { book: similarBook } = findMostSimilarBook(
      r.item,
      booksRaw,
      existingVectors,
      profileVector
    );

    const common = {
      id: `rec-${i}`,
      title: r.title,
      author: r.author,
      cover: cover || "",
      score: r.score,
      quote: `Pela afinidade com ${topAffinity}`,
      rating: estimatedRating(r.score),
      tags: r.tags,
    };

    const primaryRec: PrimaryRecommendation = {
      ...common,
      edition: googleBookEdition(r.item),
      pages,
      spine: buildSpineEstimate(pages),
      compat: Math.round(r.score * 100),
      predictedRating: estimatedRating(r.score),
      ragQuote: buildRagQuote(r.title, r.author, topAffinity, similarBook),
      similarity: Math.round(r.score * 1000) / 1000,
      vectorId: similarBook?.id || `profile-${userId.slice(-8)}`,
    };

    if (i === 0) {
      primary = primaryRec;
    } else {
      queue.push({
        id: common.id,
        title: common.title,
        author: common.author,
        cover: common.cover,
        score: common.score,
        quote: common.quote,
        rating: common.rating,
        tags: common.tags,
      });
    }
  }

  return {
    primary,
    queue,
    profile: {
      affinity,
      feedbackCount,
      recommendationFeedbackCount,
      calibration,
    },
    books,
  };
}
