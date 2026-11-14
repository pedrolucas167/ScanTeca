import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { createEvidenceRegistry } from "./evidence";

export function requestsWebSearch(question: string) {
  return /^(?:por favor,?\s+)?(?:pesquise|busque|procure|consulte)\s+(?:na internet|na web|no brave)(?=$|[\s:,.!?])/iu.test(question);
}

export function parseWebQuery(question: string) {
  if (!requestsWebSearch(question)) return null;
  const terms = question.replace(/^.*?\s+(?:na internet|na web|no brave)\s*[:,]?\s*/iu, "");
  const query = /^(?:"([^"“”\p{C}]{1,300})"|“([^"“”\p{C}]{1,300})”)[?.!]?$/u.exec(terms);
  return (query?.[1] ?? query?.[2])?.trim() || null;
}

export function braveSearchKey() {
  return process.env.BRAVE_SEARCH_API_KEY?.trim() || process.env.key_brave_api?.trim();
}

export function cleanSearchText(value: unknown, limit: number) {
  return typeof value === "string" ? value.slice(0, limit * 2).replace(/\s+/gu, " ").trim().slice(0, limit) : "";
}

async function fetchBraveContext(query: string, key: string, signal: AbortSignal) {
  const endpoint = new URL("https://api.search.brave.com/res/v1/llm/context");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("maximum_number_of_tokens", "2048");
  endpoint.searchParams.set("context_threshold_mode", "balanced");
  endpoint.searchParams.set("enable_local", "false");
  const response = await fetchWithTimeout(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    cache: "no-store", redirect: "error", signal,
  }, 8000);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Busca web indisponível");
  }

  const data: { grounding?: { generic?: unknown } } = await response.json();
  return data?.grounding;
}

export async function lookupWebEvidence(query: string, key: string, signal: AbortSignal) {
  const items = (await fetchBraveContext(query, key, signal))?.generic ?? [];
  if (!Array.isArray(items)) throw new Error("Resposta de busca inválida");
  const registry = createEvidenceRegistry();
  const seen = new Set<string>();
  const content: string[] = [];
  for (const item of items) {
    if (!item || typeof item.url !== "string" || item.url.length > 2048 || !Array.isArray(item.snippets)) continue;
    let url: URL;
    try { url = new URL(item.url); } catch { continue; }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) continue;
    url.hash = "";
    if (seen.has(url.href)) continue;
    const snippets = item.snippets.slice(0, 2).map((snippet: unknown) => cleanSearchText(snippet, 1000)).filter(Boolean);
    if (!snippets.length) continue;
    seen.add(url.href);
    const title = cleanSearchText(item.title, 180) || url.hostname;
    const evidence = snippets.join("\n");
    content.push(registry.add({
      id: `brave-${seen.size}`, title, author: url.hostname, url: url.href, external: true,
      matchedBy: "Brave Search", evidence,
    }, JSON.stringify({ title, domain: url.hostname, snippets })));
    if (content.length === 5) break;
  }
  return { sources: registry.sources, content: content.join("\n") };
}
