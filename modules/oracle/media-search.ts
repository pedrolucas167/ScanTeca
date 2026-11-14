import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { createEvidenceRegistry } from "./evidence";
import { cleanSearchText } from "./web-search";

const requestPrefix = /^(?:por favor,?\s+)?(?:(?:(?:me\s+)?(?:traga|mostre|encontre|busque|procure|pesquise|indique|recomende|exiba)(?:-me|\s+para mim)?|(?:voc[eê]\s+)?(?:pode|poderia|consegue|conseguiria)\s+(?:me\s+)?(?:mostrar|buscar|trazer|encontrar|indicar|recomendar|exibir)|(?:eu\s+)?(?:quero|gostaria de)\s+(?:ver|assistir(?:\s+a)?|encontrar)|(?:voc[eê]\s+)?(?:tem|conhece)|(?:onde|como)\s+(?:posso|podemos)\s+(?:ver|assistir(?:\s+a)?|encontrar))\s+)?(?:(?:a|as|o|os|um|uma|algum|alguma|algumas|alguns)\s+)?/iu;
const mediaNoun = /^(not[ií]cias?|v[ií]deos?|(?:entrevistas?|resenhas?) em v[ií]deo)(?=$|[\s:?.!])/iu;

function mediaCommand(question: string) {
  const rest = question.trim().replace(requestPrefix, "");
  const match = mediaNoun.exec(rest);
  if (match?.[1]) return { noun: match[1], terms: rest.slice(match[0].length).trim() };
  // Accept the same request with the medium after its subject: resenhas de livros em vídeo.
  const suffix = /^(resenhas?|entrevistas?)\s+(.+?)\s+em v[ií]deo[?.!]?$/iu.exec(rest);
  return suffix?.[1] && suffix[2] ? { noun: `${suffix[1]} em vídeo`, terms: suffix[2] } : null;
}

export type MediaQuery = { kind: "news" | "videos"; query: string; freshness?: "pd" | "pw" | "pm" };

export function requestsMediaSearch(question: string) { return mediaCommand(question) !== null; }

export function parseMediaQuery(question: string): MediaQuery | null {
  const prefix = mediaCommand(question);
  if (!prefix) return null;
  const kind = /^not[ií]cias?$/iu.test(prefix.noun) ? "news" : "videos";
  let terms = prefix.terms;
  let freshness: MediaQuery["freshness"];
  const period = /^(recentes|de hoje|desta semana|deste mês)(?=$|\s|:)/iu.exec(terms);
  if (period?.[1]) {
    freshness = /hoje/iu.test(period[1]) ? "pd" : /semana/iu.test(period[1]) ? "pw" : "pm";
    terms = terms.slice(period[0].length).trim();
  }
  const relation = /^(?:sobre|de|do|da|dos|das|com)\s+/iu.exec(terms)?.[0].trim();
  terms = terms.replace(/^(?::\s*|(?:sobre|de|do|da|dos|das|com)\s+)/iu, "").trim();
  const quoted = /^(?:"([^"“”\p{C}]+)"|“([^"“”\p{C}]+)”)[?.!]?$/u.exec(terms);
  const plain = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’–-]*[?.!]?$/u.test(terms) ? terms.replace(/[?.!]$/, "") : "";
  let query = (quoted?.[1] ?? quoted?.[2] ?? plain).trim();
  if (!query || query.length > 200 || query.split(/\s+/).length > 30) return null;
  // Only the explicit public search terms leave the app, never library or history context.
  if (!quoted && /\b(?:meu|minha|meus|minhas|nosso|nossa|acervo|diário|histórico|inclua|envie|adicione)\b/iu.test(query)) return null;
  const format = /^(entrevistas?|resenhas?) em/iu.exec(prefix.noun)?.[1];
  if (format) query = `${format}${relation ? ` ${relation}` : ""} ${query}`;
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
