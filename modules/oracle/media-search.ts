import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { createEvidenceRegistry } from "./evidence";
import { cleanSearchText } from "./web-search";

const command = /^(?:por favor,?\s+)?(?:(?:(?:traga|mostre|encontre|busque|procure|pesquise)(?:\s+para mim)?|(?:pode|poderia)\s+(?:me\s+)?(?:mostrar|buscar)|quero ver)\s+)?(?:(?:as|os|algumas|alguns)\s+)?(notícias|noticias|vídeos|videos|entrevistas em v[ií]deo)(?=$|[\s:?.!])/iu;

export type MediaQuery = { kind: "news" | "videos"; query: string; freshness?: "pd" | "pw" | "pm" };

export function requestsMediaSearch(question: string) { return command.test(question); }

export function parseMediaQuery(question: string): MediaQuery | null {
  const prefix = command.exec(question);
  if (!prefix?.[1]) return null;
  const kind = /^not[ií]cias$/iu.test(prefix[1]) ? "news" : "videos";
  let terms = question.slice(prefix[0].length).trim();
  let freshness: MediaQuery["freshness"];
  const period = /^(recentes|de hoje|desta semana|deste mês)(?=$|\s|:)/iu.exec(terms);
  if (period?.[1]) {
    freshness = /hoje/iu.test(period[1]) ? "pd" : /semana/iu.test(period[1]) ? "pw" : "pm";
    terms = terms.slice(period[0].length).trim();
  }
  terms = terms.replace(/^(?::\s*|(?:sobre|de|do|da|dos|das)\s+)/iu, "").trim();
  const quoted = /^(?:"([^"“”\p{C}]+)"|“([^"“”\p{C}]+)”)[?.!]?$/u.exec(terms);
  const plain = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’–-]*[?.!]?$/u.test(terms) ? terms.replace(/[?.!]$/, "") : "";
  let query = (quoted?.[1] ?? quoted?.[2] ?? plain).trim();
  if (!query || query.length > 200 || query.split(/\s+/).length > 30) return null;
  // Only the explicit public search terms leave the app, never library or history context.
  if (!quoted && /\b(?:meu|minha|meus|minhas|nosso|nossa|acervo|diário|histórico|inclua|envie|adicione)\b/iu.test(query)) return null;
  if (/^entrevistas/iu.test(prefix[1])) query = `entrevistas ${query}`;
  return { kind, query, ...(freshness ? { freshness } : {}) };
}

function publicUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048 || /[\s\p{C}]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    url.hash = "";
    return url;
  } catch { return null; }
}

export async function lookupMediaEvidence(search: MediaQuery, key: string, signal: AbortSignal) {
  const endpoint = new URL(`https://api.search.brave.com/res/v1/${search.kind}/search`);
  endpoint.search = new URLSearchParams({ q: search.query, count: "10", search_lang: "pt-br",
    country: "ALL", safesearch: "strict", ...(search.freshness ? { freshness: search.freshness } : {}) }).toString();
  const response = await fetchWithTimeout(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    signal, cache: "no-store", redirect: "error",
  }, 8000);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Pesquisa de notícias ou vídeos indisponível");
  }
  const data: { results?: unknown } = await response.json();
  if (!Array.isArray(data?.results)) throw new Error("Resposta de pesquisa inválida");
  const registry = createEvidenceRegistry();
  const content: string[] = [];
  const seen = new Set<string>();
  for (const item of data.results) {
    const url = publicUrl(item?.url);
    const title = cleanSearchText(item?.title, 180);
    if (!url || !title || seen.has(url.href)) continue;
    seen.add(url.href);
    const description = cleanSearchText(item.description, 800);
    // Provider dates describe the page (publication or update), not necessarily the event.
    const pageDate = cleanSearchText(item.page_age, 60);
    const creator = search.kind === "videos" ? cleanSearchText(item.video?.creator, 120) : "";
    const duration = search.kind === "videos" ? cleanSearchText(item.video?.duration, 40) : "";
    const evidence = [description, pageDate && `Data informada da página: ${pageDate}`,
      creator && `Canal/criador: ${creator}`, duration && `Duração informada: ${duration}`].filter(Boolean).join("\n");
    content.push(registry.add({ id: `brave-${search.kind}-${seen.size}`, title, author: url.hostname,
      url: url.href, external: true, matchedBy: search.kind === "news" ? "Brave Notícias" : "Brave Vídeos", evidence,
    }, JSON.stringify({ title, domain: url.hostname, description, pageDate, creator, duration })));
    if (content.length === 5) break;
  }
  return { sources: registry.sources, content: content.join("\n") };
}
