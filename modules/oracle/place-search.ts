import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { createEvidenceRegistry } from "./evidence";
import { cleanSearchText } from "./web-search";

const placeCommand = /^(?:por favor,?\s+)?(?:encontre|busque|procure|pesquise|localize)\s+(livrarias?|bibliotecas?|lugares?)(?=$|[\s:?.!])/iu;

export function requestsPlaceSearch(question: string) {
  return placeCommand.test(question);
}

export function parsePlaceQuery(question: string) {
  const match = placeCommand.exec(question);
  const kind = match?.[1];
  if (!match || !kind) return null;
  const rest = question.slice(match[0].length);
  const parts = /^(?:\s*:\s*["“]([\p{L}\p{M} .,'’–-]{2,80})["”])?\s+em\s+["“]([\p{L}\p{M} .,'’–-]{2,100})["”][?.!]?$/iu.exec(rest);
  const area = parts?.[2]?.trim();
  const category = parts?.[1]?.trim();
  if (!area || !/\p{L}/u.test(area) || /^(?:mim|minha cidade|meu bairro|casa|redor|volta)$/iu.test(area)) return null;
  const generic = /^lugares?$/iu.test(kind);
  if (generic ? !category || !/\p{L}/u.test(category) : Boolean(category)) return null;
  return { area, query: `${category ?? kind} em ${area}` };
}

function coordinates(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [latitude, longitude] = value;
  if (typeof latitude !== "number" || typeof longitude !== "number" ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)) return null;
  return `${latitude},${longitude}`;
}

function createMapLinks(name: string, coordinate: string) {
  const destination = encodeURIComponent(coordinate);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${destination}`,
    apple: `https://maps.apple.com/place?coordinate=${destination}&name=${encodeURIComponent(name)}`,
    waze: `https://waze.com/ul?ll=${destination}&navigate=yes`,
  };
}

function normalizeLocation(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function addressMatchesArea(address: string, area: string) {
  const parts = area.split(",").map(normalizeLocation).filter(Boolean);
  const normalized = ` ${normalizeLocation(address)} `;
  return parts.length > 0 && parts.every(part => normalized.includes(` ${part} `));
}

function placeWebsite(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function lookupPlaceEvidence({ query, area }: { query: string; area: string }, key: string, signal: AbortSignal) {
  const endpoint = new URL("https://api.search.brave.com/res/v1/local/place_search");
  endpoint.search = new URLSearchParams({
    q: query, location: area.replace(/[,\s]+/g, " ").trim(), search_lang: "pt-br", count: "8",
  }).toString();
  const response = await fetchWithTimeout(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
    cache: "no-store", redirect: "error", signal,
  }, 8000);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Busca de lugares indisponível");
  }
  const data: { results?: unknown } = await response.json();
  const results = data?.results ?? [];
  if (!Array.isArray(results)) throw new Error("Resposta de lugares inválida");
  const registry = createEvidenceRegistry();
  const seen = new Set<string>();
  const content: string[] = [];
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const item = result as Record<string, unknown>;
    const name = cleanSearchText(item.title, 160);
    if (!name || !/\p{L}/u.test(name)) continue;
    const postal = item.postal_address as { displayAddress?: unknown } | null | undefined;
    const address = cleanSearchText(postal?.displayAddress, 250);
    // The location parameter biases results. Verify the returned address before linking.
    if (address && !addressMatchesArea(address, area)) continue;
    const coordinate = address ? coordinates(item.coordinates) : null;
    const identity = `${name.toLocaleLowerCase("pt-BR")}|${coordinate ?? address}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const mapLinks = coordinate ? createMapLinks(name, coordinate) : undefined;
    const website = placeWebsite(item.url);
    const url = website ?? mapLinks?.google;
    content.push(registry.add({
      id: `brave-place-${seen.size}`, title: name, author: website ? new URL(website).hostname : area,
      external: true, sourceType: "place", matchedBy: "Brave Search · Lugares",
      ...(url ? { url } : {}),
      evidence: address || null, ...(mapLinks ? { mapLinks } : {}),
    }, JSON.stringify({ name, address: address || undefined, hasMapLinks: Boolean(mapLinks) })));
    if (content.length === 5) break;
  }
  return { sources: registry.sources, content: content.join("\n") };
}
