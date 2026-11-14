import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { Source } from "@/lib/types/oracle";
import { cleanSearchText } from "./web-search";

const command = /^(?:por favor,?\s+)?(?:(?:traga|mostre|encontre|busque|procure|pesquise)(?:-me|\s+para mim)?|me\s+(?:traga|mostre)|(?:pode|poderia|consegue)\s+(?:me\s+)?(?:mostrar|trazer|buscar|encontrar)|(?:quero|gostaria de)\s+ver)\s+(?:(?:a|as|uma|algumas)\s+)?(imagem|imagens|capas?)(?=$|[\s:?.!])/iu;

export function requestsImageSearch(question: string) {
  return command.test(question);
}

export function parseImageQuery(question: string) {
  const prefix = command.exec(question);
  if (!prefix) return null;
  const terms = question.slice(prefix[0].length).replace(/^\s*(?::\s*|d[aeo]s?\s+)/iu, "").trim();
  const quoted = /^(?:"([^"“”\p{C}]+)"|“([^"“”\p{C}]+)”)[?.!]?$/u.exec(terms);
  const plain = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} '’–-]*[?.!]?$/u.test(terms)
    ? terms.replace(/[?.!]$/, "") : "";
  const query = (quoted?.[1] ?? quoted?.[2] ?? plain).trim();
  const searchQuery = prefix[1]?.toLowerCase().startsWith("capa") ? `capas de ${query}` : query;
  if (!query || searchQuery.length > 200 || searchQuery.split(/\s+/).length > 30) return null;
  if (!quoted && /\b(?:meu|minha|meus|minhas|nosso|nossa|acervo|diário|histórico|inclua|envie|adicione)\b/iu.test(query)) return null;
  return searchQuery;
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 4096 || /[\s\p{C}]/u.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

export async function searchOracleImages(query: string, key: string, signal: AbortSignal) {
  const endpoint = new URL("https://api.search.brave.com/res/v1/images/search");
  endpoint.search = new URLSearchParams({ q: query, count: "12", safesearch: "strict" }).toString();
  const response = await fetchWithTimeout(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    cache: "no-store", redirect: "error", signal,
  }, 8000);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Busca de imagens indisponível");
  }
  const data: { results?: unknown } = await response.json();
  if (!Array.isArray(data?.results)) throw new Error("Resposta de imagens inválida");
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const result of data.results) {
    const page = httpsUrl(result?.url);
    const thumbnail = httpsUrl(result?.thumbnail?.src);
    if (!page || !thumbnail || thumbnail.hostname !== "imgs.search.brave.com" || seen.has(thumbnail.href)) continue;
    seen.add(thumbnail.href);
    const title = cleanSearchText(result.title, 180);
    sources.push({
      id: `brave-image-${sources.length + 1}`, title: title || page.hostname,
      author: page.hostname, url: page.href, sourceType: "image", external: true,
      thumbnail: { url: thumbnail.href, alt: title || `Resultado de imagem para ${query} em ${page.hostname}` },
    });
    if (sources.length === 6) break;
  }
  return sources;
}
