import { createEvidenceRegistry } from "./evidence";
import { cleanSearchText, fetchBraveContext } from "./web-search";

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

function coordinates(latitude: unknown, longitude: unknown) {
  if (typeof latitude !== "number" || typeof longitude !== "number" ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return `${latitude},${longitude}`;
}

function createMapLinks(name: string, area: string, address: string, coordinate: string | null) {
  const search = address || `${name}, ${area}`;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinate ?? search)}`,
    apple: coordinate
      ? `https://maps.apple.com/place?coordinate=${encodeURIComponent(coordinate)}&name=${encodeURIComponent(name)}`
      : `https://maps.apple.com/search?query=${encodeURIComponent(search)}`,
    waze: coordinate
      ? `https://waze.com/ul?ll=${encodeURIComponent(coordinate)}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(search)}`,
  };
}

function placeWebsite(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function lookupPlaceEvidence({ query, area }: { query: string; area: string }, key: string, signal: AbortSignal) {
  const grounding = await fetchBraveContext(query, key, signal, true);
  const results: unknown[] = [grounding?.poi, ...(Array.isArray(grounding?.map) ? grounding.map : [])];
  const registry = createEvidenceRegistry();
  const seen = new Set<string>();
  const content: string[] = [];
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const item = result as Record<string, unknown>;
    const name = cleanSearchText(item.name, 160);
    if (!name || !/\p{L}/u.test(name)) continue;
    // The documented local results may contain only a name and website.
    // Use structured location fields if present. Snippets can refer to another branch.
    const address = cleanSearchText(item.address, 250);
    const coordinate = coordinates(item.latitude, item.longitude);
    const identity = `${name.toLocaleLowerCase("pt-BR")}|${coordinate ?? address}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const mapLinks = createMapLinks(name, area, address, coordinate);
    const website = placeWebsite(item.url);
    content.push(registry.add({
      id: `brave-place-${seen.size}`, title: name, author: website ? new URL(website).hostname : area,
      external: true, matchedBy: "Brave Search · Lugares", url: website ?? mapLinks.google,
      evidence: address || null, mapLinks,
    }, JSON.stringify({ name, address: address || undefined })));
    if (content.length === 5) break;
  }
  return { sources: registry.sources, content: content.join("\n") };
}
