import { prisma } from "./prisma";

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áàâãéêíóôõúç\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export function isTitleSimilar(query: string, found: string): boolean {
  const queryWords = normalize(query);
  const foundWords = normalize(found);
  if (queryWords.length === 0 || foundWords.length === 0) return false;

  const common = queryWords.filter((w) =>
    foundWords.some((fw) => fw === w || fw.startsWith(w) || w.startsWith(fw))
  );

  // Títulos curtos (<=3 palavras significantes): cada palavra deve aparecer.
  if (queryWords.length <= 3) return common.length === queryWords.length;

  // Títulos maiores (com subtítulo): aceita a maioria.
  return common.length >= Math.max(1, Math.ceil(queryWords.length * 0.5));
}

export function isAuthorSimilar(query: string, found: string): boolean {
  const queryWords = normalize(query);
  const foundWords = normalize(found);
  if (queryWords.length === 0) return true;
  if (foundWords.length === 0) return false;
  return queryWords.some((w) =>
    foundWords.some((fw) => fw === w || fw.includes(w) || w.includes(fw))
  );
}

const ENGLISH_TO_PORTUGUESE_GENRE: Record<string, string> = {
  fiction: "Ficção",
  "science fiction": "Ficção científica",
  "young adult fiction": "Jovem adulto",
  "young adult nonfiction": "Jovem adulto",
  "juvenile fiction": "Infantojuvenil",
  "juvenile nonfiction": "Infantojuvenil",
  "children's fiction": "Infantil",
  "children's nonfiction": "Infantil",
  "comics & graphic novels": "Histórias em quadrinhos",
  "graphic novels": "Histórias em quadrinhos",
  manga: "Mangá",
  romance: "Romance",
  "mystery & detective": "Mistério",
  mystery: "Mistério",
  thriller: "Suspense",
  horror: "Terror",
  fantasy: "Fantasia",
  history: "História",
  "biography & autobiography": "Biografia",
  biography: "Biografia",
  autobiography: "Autobiografia",
  memoir: "Memórias",
  science: "Ciência",
  philosophy: "Filosofia",
  religion: "Religião",
  "self-help": "Autoajuda",
  "business & economics": "Negócios",
  business: "Negócios",
  economics: "Economia",
  computers: "Informática",
  cookery: "Culinária",
  cooking: "Culinária",
  travel: "Viagem",
  art: "Arte",
  music: "Música",
  poetry: "Poesia",
  drama: "Drama",
  literary: "Literatura",
  literature: "Literatura",
  "non-fiction": "Não-ficção",
  nonfiction: "Não-ficção",
};

/** Remove espaços múltiplos, trim e normaliza aspas tipográficas. */
export function cleanTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const cleaned = title
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
  if (!cleaned) return null;
  return cleaned;
}

/**
 * Separa o título principal do subtítulo quando há `:` ou traços.
 * Usado para busca de capa/sinopse: o subtítulo costuma confundir
 * os provedores e ainda polui a comparação de títulos.
 */
export function extractMainTitle(fullTitle: string | null | undefined): string | null {
  const title = cleanTitle(fullTitle);
  if (!title) return null;

  // Primeiro tenta `:` (subtítulo explícito mais confiável)
  const colon = title.indexOf(":");
  if (colon > 0) {
    const main = title.slice(0, colon).trim();
    if (main.length >= 3) return main;
  }

  // Depois em/en-dashes separados por espaço (comum em edições)
  const dashMatch = title.match(/^(.+?)(?:\s+(?:–|—|-))\s+/);
  if (dashMatch) {
    const main = dashMatch[1].trim();
    if (main.length >= 3) return main;
  }

  return title;
}

/** Se um subtítulo for identificado, retorna ele separadamente. */
export function extractSubtitle(fullTitle: string | null | undefined): string | null {
  const title = cleanTitle(fullTitle);
  if (!title) return null;

  const colon = title.indexOf(":");
  if (colon > 0 && colon < title.length - 1) {
    const sub = title.slice(colon + 1).trim();
    return sub || null;
  }

  const dashMatch = title.match(/^.+?(?:\s+(?:–|—|-))\s+(.+)$/);
  if (dashMatch) return dashMatch[1].trim() || null;

  return null;
}

/** Limpa e normaliza o nome do autor. */
export function normalizeAuthor(author: string | null | undefined): string | null {
  if (!author) return null;
  const trimmed = author.trim().replace(/\s+/g, " ");
  const lower = trimmed.toLowerCase();

  if (
    !lower ||
    lower === "autor desconhecido" ||
    lower === "[author not identified]" ||
    lower === "desconhecido" ||
    lower === "unknown"
  ) {
    return null;
  }

  // Remove funções editoriais no final: (Org.), (Editor), (Trad.), etc.
  const withoutRole = trimmed
    .replace(
      /\s*\([^)]*(?:org|editor|trad|coord|compil|adapt|ilust)[^)]*\)\s*$/i,
      ""
    )
    .trim();

  // Inverte "Sobrenome, Nome" quando há exatamente uma vírgula
  const parts = withoutRole.split(",");
  if (parts.length === 2) {
    const [last, first] = parts.map((p) => p.trim());
    if (last && first) return `${first} ${last}`;
  }

  return withoutRole;
}

/** Limpa e mapeia gênero para português, quando a fonte é em inglês. */
export function normalizeGenre(genre: string | null | undefined): string | null {
  if (!genre) return null;
  const cleaned = genre.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();

  // Categorias compostas do Google Books vêm como "Fiction / Literary".
  // Pegamos o segmento mais específico (último) e tentamos mapear.
  const segments = lower.split("/").map((s) => s.trim());
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (ENGLISH_TO_PORTUGUESE_GENRE[segment]) {
      return ENGLISH_TO_PORTUGUESE_GENRE[segment];
    }
  }

  if (ENGLISH_TO_PORTUGUESE_GENRE[lower]) {
    return ENGLISH_TO_PORTUGUESE_GENRE[lower];
  }

  // Mantém o original capitalizado se não conseguir mapear.
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Limpa ISBN: remove tudo que não for dígito ou X e valida tamanho. */
export function cleanIsbn(isbn: string | null | undefined): string | null {
  if (!isbn) return null;
  const cleaned = isbn.replace(/[^0-9X]/gi, "").toUpperCase();
  if (cleaned.length !== 10 && cleaned.length !== 13) return null;
  // ISBN-13 começa com 978 ou 979; ISBN-10 pode terminar com X.
  if (cleaned.length === 13 && !cleaned.startsWith("978") && !cleaned.startsWith("979")) {
    return null;
  }
  return cleaned;
}

export function isPlaceholderIsbn(isbn: string | null | undefined): boolean {
  return !isbn || isbn.startsWith("MANUAL-") || isbn.startsWith("manual-");
}

export function isUnknownAuthor(author: string | null | undefined): boolean {
  if (!author) return true;
  const a = author.trim().toLowerCase();
  return (
    a === "" ||
    a === "autor desconhecido" ||
    a === "[author not identified]" ||
    a === "desconhecido" ||
    a === "unknown"
  );
}

export function isUnknownTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  return t === "" || t === "título desconhecido";
}

/**
 * Melhora URLs de capa:
 * - força https
 * - Google Books: zoom=1 -> zoom=0 (imagem maior)
 */
export function upgradeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u = url.trim();
  if (u.startsWith("http:")) u = `https${u.slice(4)}`;
  if (u.includes("books.google.com")) {
    u = u.replace(/([?&])zoom=1\b/, "$1zoom=0");
  }
  if (u.includes("covers.openlibrary.org")) {
    // Prefer large covers over medium/small.
    u = u.replace(/-M\.jpg$/i, "-L.jpg").replace(/-S\.jpg$/i, "-L.jpg");
  }
  return u;
}

/** Heurística simples: remove "publisher", "published" e afins que confundem busca. */
export function cleanQueryTitle(title: string | null | undefined): string | null {
  const main = extractMainTitle(title);
  return main;
}

/** Compara dois livros por título+autor para evitar duplicatas. */
export function isBookSimilar(
  titleA: string,
  authorA: string | null,
  titleB: string,
  authorB: string | null
): boolean {
  const aTitle = (titleA || "").toLowerCase().trim();
  const bTitle = (titleB || "").toLowerCase().trim();
  const aAuthor = (authorA || "").toLowerCase().trim();
  const bAuthor = (authorB || "").toLowerCase().trim();

  if (!isTitleSimilar(aTitle, bTitle)) return false;

  // Se um dos autores for desconhecido, aceita o match pelo título.
  if (isUnknownAuthor(aAuthor) || isUnknownAuthor(bAuthor)) return true;

  return isAuthorSimilar(aAuthor, bAuthor);
}

/** Busca no acervo do usuário um livro provavelmente duplicado. */
export async function findExistingBookByTitleAuthor(
  userId: string,
  title: string,
  author: string | null | undefined
) {
  const qTitle = title.toLowerCase().trim();
  const qAuthor = (author || "").toLowerCase().trim();

  const books = await prisma.book.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      author: true,
      isbn: true,
      coverUrl: true,
      publishedDate: true,
      collection: { select: { name: true } },
    },
  });

  for (const book of books) {
    if (
      isBookSimilar(qTitle, qAuthor, book.title || "", book.author || null)
    ) {
      return book;
    }
  }

  return null;
}
