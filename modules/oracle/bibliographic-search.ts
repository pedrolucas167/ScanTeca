import { fetchGoogleBooksVolumes } from "@/lib/google-books";
import { matchesEdition, parseSearchIsbn } from "@/lib/book-search-rules";
import { createEvidenceRegistry } from "./evidence";

export function requestsBibliographicSearch(question: string) {
  return /^(?:por favor,?\s+)?(?:pesquise|busque|procure|consulte)\s+(?:na internet|no google books|no catálogo externo)(?=$|[\s:,.!?])/iu.test(question);
}

export function parseBibliographicQuery(question: string) {
  if (!requestsBibliographicSearch(question)) return null;
  const terms = question.replace(/^.*?\s+(?:na internet|no google books|no catálogo externo)\s*[:,]?\s*(?:por\s+)?/iu, "").trim();
  const isbn = parseSearchIsbn(terms.replace(/[?.!]$/, ""));
  if (isbn) return { query: `isbn:${isbn.isbn}`, exactIsbn: isbn.exactIsbn };

  const field = /^(autor(?:a|ia)?|título|titulo|ediç(?:ão|ões))\s*:\s*["“]([\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'’&()–—-]{0,119})["”][?.!]?$/iu.exec(terms);
  const label = field?.[1];
  const value = field?.[2];
  if (!label || !value) return null;
  const operator = /^autor/iu.test(label) ? "inauthor" : "intitle";
  return { query: `${operator}:"${value.trim()}"`, exactIsbn: null };
}

export async function lookupBibliographicEvidence(
  { query, exactIsbn }: NonNullable<ReturnType<typeof parseBibliographicQuery>>,
  requestSignal: AbortSignal,
) {
  const registry = createEvidenceRegistry();
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(5000)]);
  const items = await fetchGoogleBooksVolumes(query, { signal, limit: 12 });
  if (!items) throw new Error("Google Books indisponível");

  const seen = new Set<string>();
  const content = [];
  for (const item of items) {
    const { id, volumeInfo: info } = item;
    if (!/^[\w-]{1,64}$/.test(id ?? "") || seen.has(id)) continue;
    if (exactIsbn && !matchesEdition(item, exactIsbn)) continue;
    seen.add(id);
    const title = info.title!.trim().slice(0, 200);
    const author = info.authors?.join(", ").slice(0, 200) || "Autoria não informada";
    const metadata = [
      info.publisher && `Editora: ${info.publisher.slice(0, 150)}`,
      info.publishedDate && `Publicação: ${info.publishedDate.slice(0, 20)}`,
      ...(info.industryIdentifiers ?? [])
        .filter(entry => /^ISBN_(10|13)$/.test(entry.type) && /^[\dX-]{10,17}$/i.test(entry.identifier))
        .slice(0, 2).map(entry => `${entry.type.replace("_", "-")}: ${entry.identifier}`),
    ].filter(Boolean).join(" · ");
    content.push(registry.add({
      id: `google-books-${id}`, title, author, external: true, matchedBy: "Google Books",
      url: `https://books.google.com/books?id=${id}`, evidence: metadata || null,
    }, `${title} — ${author}${metadata ? ` · ${metadata}` : ""}`));
    if (content.length === 4) break;
  }
  return { sources: registry.sources, content: content.join("\n") };
}
