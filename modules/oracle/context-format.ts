import { createEvidenceRegistry } from "./evidence";
import { MAX_DIARY_ENTRIES, type loadOracleContext, type retrieveOracleMemories } from "./context";
import type { OracleBook } from "./retrieval";

export interface ExternalBook { title: string; author: string; description: string | null; genre: string | null }
type ReaderContext = Awaited<ReturnType<typeof loadOracleContext>>;
type Memories = Awaited<ReturnType<typeof retrieveOracleMemories>>;
const DISTANCE_THRESHOLD = 0.7;

/** Formatting and source numbering share one registry; inputs are never mutated. */
export function formatOracleContext(input: Pick<ReaderContext, "readingNow" | "weekLogs" | "diaryEntries"> & Memories & {
  contextBooks: OracleBook[]; externalBooks: ExternalBook[]; retrievalQuery: string;
}) {
  const { contextBooks, externalBooks, readingNow, weekLogs, diaryEntries, semanticDiary, semanticReviews, semanticExternal, retrievalQuery } = input;
  const evidence = createEvidenceRegistry();
  const sources = evidence.sources;
  const context =
    contextBooks.length > 0
      ? contextBooks
          .map(
            (b) => evidence.add({ id: b.id, title: b.title, author: b.author, status: b.status,
                genre: b.genre, relevance: b.relevance, matchedBy: b.matchedBy,
                evidence: b.synopsis?.slice(0, 500) ?? `Título: ${b.title}; autor: ${b.author}; status: ${b.status}` },
              `"${b.title}" — ${b.author}` +
              (b.publishedDate ? ` (${b.publishedDate})` : "") +
              (b.genre ? ` [${b.genre}]` : "") +
              `\n   Status: ${b.status === "READ" ? "Lido" : b.status === "READING" ? "Lendo" : b.status === "TO_READ" ? "A ler" : "Desejo"}` +
              (b.rating ? ` | Avaliação: ${b.rating}/5` : "") +
              (b.synopsis ? `\n   Sinopse: ${b.synopsis.slice(0, 500)}` : ""))
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

  const relevantDiary = semanticDiary.filter((entry) => Number(entry.distance) < DISTANCE_THRESHOLD);
  const relevantReviews = semanticReviews.filter((review) => Number(review.distance) < DISTANCE_THRESHOLD);
  const relevantExternal = semanticExternal.filter((data) => Number(data.distance) < DISTANCE_THRESHOLD);
  const diaryIntent = /\b(diário|anotações?|memórias?|registros?|reflexões?)\b/i.test(
    retrievalQuery
  );
  const diaryContextEntries = diaryIntent
    ? [...relevantDiary, ...diaryEntries]
    : relevantDiary;
  const diarySection = diaryContextEntries.length
    ? `\n\nMemórias do diário de leitura:\n${diaryContextEntries
        .filter((entry, index, all) => all.findIndex((other) => ("id" in other ? other.id : "") === entry.id) === index)
        .slice(0, MAX_DIARY_ENTRIES)
        .map((entry) => {
          const title = "bookTitle" in entry ? entry.bookTitle : entry.book.title;
          const page = entry.page;
          const author = "bookAuthor" in entry ? entry.bookAuthor : entry.book.author;
          return evidence.add({ id: entry.id, title, author, sourceType: "diary", status: "MEMORY",
            matchedBy: "memória do diário", evidence: entry.content.slice(0, 500) },
            `- [${entry.type}] "${title}"${page ? `, pág. ${page}` : ""}: ${entry.content.slice(0, 500)}`);
        })
        .join("\n")}`
    : "";
  const reviewSection = relevantReviews.length
    ? `\n\nAvaliações relevantes:\n${relevantReviews
        .map((review) => evidence.add({ id: review.id, title: review.bookTitle, author: review.bookAuthor,
          sourceType: "review", status: "REVIEW", matchedBy: "avaliação do leitor", evidence: review.content.slice(0, 500) },
          `- "${review.bookTitle}" — ${review.bookAuthor}${review.rating ? ` (${review.rating}/5)` : ""}: ${review.content.slice(0, 500)}`))
        .join("\n")}`
    : "";
  const externalSection = relevantExternal.length
    ? `\n\nPesquisa externa relevante:\n${relevantExternal
        .map((data) => evidence.add({ id: data.id, title: data.title, author: data.source, external: true,
          matchedBy: "pesquisa externa", evidence: data.content.slice(0, 500) },
          `- [${data.source} - ${data.type}] "${data.title}": ${data.content.slice(0, 500)}`))
        .join("\n")}`
    : "";

  const progressIntent = /\b(lendo|leitura atual|em andamento|progresso|página|paginas|páginas)\b/i.test(
    retrievalQuery
  );
  const hasGrounding =
    contextBooks.length > 0 ||
    relevantDiary.length > 0 ||
    relevantReviews.length > 0 ||
    relevantExternal.length > 0 ||
    (diaryIntent && diaryEntries.length > 0) ||
    (progressIntent && readingNow.length > 0) ||
    externalBooks.length > 0;

  const externalContext =
    externalBooks.length > 0
      ? `\n\nSugestões fora do acervo (o leitor NÃO possui estes livros):\n${externalBooks
          .map(
            (b, i) => evidence.add({ id: `ext-${i}`, title: b.title, author: b.author, external: true,
              genre: b.genre, matchedBy: "catálogo externo", evidence: b.description?.slice(0, 300) ?? null },
              `"${b.title}" — ${b.author} [FORA DO ACERVO]` +
              (b.genre ? ` [${b.genre}]` : "") +
              (b.description ? `\n   Sinopse: ${b.description.slice(0, 300)}` : ""))
          )
          .join("\n\n")}`
      : "";


  return { sources, hasGrounding, selectedDiary: relevantDiary.length, selectedReviews: relevantReviews.length,
    selectedExternal: relevantExternal.length,
    content: `Livros relevantes do acervo:\n${context}${externalContext}${progressSection ? `\n\nLeituras em andamento do usuário:\n${progressSection}` : ""}${weekSection}${diarySection}${reviewSection}${externalSection}` };
}
