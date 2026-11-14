import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { createEvidenceRegistry } from "./evidence";
import { cleanSearchText } from "./web-search";
import { requestNearbyPlaces } from "./nearby-brave-request";

const placeCommand = /^(?:por favor,?\s+)?(?:encontre|busque|procure|pesquise|localize|mostre)\s+(.+?)(?:\s+em\s+(.+))?[?.!]?$/iu;
const nearbyQuestion = /^(?:qual(?:\s+[ée])?|quais(?:\s+s[ãa]o)?)\s+(?:(?:a|o|as|os)\s+)?(.+?)\s+(?:mais\s+pr[óo]xim[oa]s?|perto de mim)[?.!]?$/iu;

function bookCategory(value: string) {
  const category = normalizeLocation(value);
  if (/^livrarias?$/.test(category)) return "livrarias";
  if (/^sebos?$/.test(category)) return "sebos";
  if (/^bibliotecas?$/.test(category)) return "bibliotecas";
  if (/^(?:cafes? (?:com|que (?:tambem )?(?:seja|sejam|sao|e)) (?:uma? )?(?:livrarias?|sebos?)|(?:livrarias?|sebos?) (?:com )?cafes?)$/.test(category)) {
    return /sebos?/.test(category) ? "cafés que também são sebos" : "cafés que também são livrarias";
  }
  return null;
}

export function requestsPlaceSearch(question: string) {
  return Boolean(parsePlaceQuery(question));
}

export function parsePlaceQuery(question: string) {
  const nearby = nearbyQuestion.exec(question)?.[1];
  const match = placeCommand.exec(question);
  const subject = nearby ?? match?.[1];
  if (!subject) return null;
  const category = bookCategory(subject
    .replace(/^(?:a|o|as|os)\s+/iu, "")
    .replace(/\s+(?:mais\s+pr[óo]xim[oa]s?|perto de mim)$/iu, ""));
  if (!category) return null;
  const rawArea = nearby ? undefined : match?.[2]?.trim();
  if (!rawArea) return { category };
  const area = rawArea.replace(/^["“]|["”]$/g, "").trim();
  if (!/^[\p{L}\p{M} .,'’–-]{2,100}$/u.test(area) || !/\p{L}/u.test(area) ||
      /\b(?:mim|minha|meu|casa|redor|volta)\b/iu.test(area)) return null;
  return { category, area };
}

export interface PlaceSearchCenter { latitude: number; longitude: number }

function distanceFrom(center: PlaceSearchCenter, latitude: number, longitude: number) {
  const radians = Math.PI / 180;
  const a = Math.sin((latitude - center.latitude) * radians / 2) ** 2 +
    Math.cos(center.latitude * radians) * Math.cos(latitude * radians) *
    Math.sin((longitude - center.longitude) * radians / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, a)));
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

function matchesCategory(item: Record<string, unknown>, name: string, category: string) {
  const categories = Array.isArray(item.categories) ? item.categories.filter(value => typeof value === "string") : [];
  const evidence = normalizeLocation([name, ...categories].join(" "));
  const bookstore = /\b(?:livrarias?|bookstore|bookshop|book store)\b/.test(evidence);
  const usedBooks = /\b(?:sebos?|used books|second hand books)\b/.test(evidence);
  if (category === "bibliotecas") return /\b(?:bibliotecas?|library|libraries)\b/.test(evidence);
  if (category === "livrarias") return bookstore;
  if (category === "sebos") return usedBooks;
  const cafe = /\b(?:cafe|cafeteria|coffee)\b/.test(evidence);
  return cafe && (category.endsWith("sebos") ? usedBooks : bookstore);
}

export async function lookupPlaceEvidence(
  { category, area, center }: { category: string; area?: string; center?: PlaceSearchCenter },
  key: string, signal: AbortSignal,
) {
  const endpoint = new URL("https://api.search.brave.com/res/v1/local/place_search");
  const radius = 10_000;
  endpoint.search = new URLSearchParams({ q: area ? `${category} em ${area}` : category, search_lang: "pt-br", count: "8" }).toString();
  if (area) endpoint.searchParams.set("location", area.replace(/[,\s]+/g, " ").trim());
  if (center) {
    endpoint.searchParams.set("latitude", String(center.latitude));
    endpoint.searchParams.set("longitude", String(center.longitude));
    endpoint.searchParams.set("radius", String(radius));
  }
  let payload: unknown;
  if (center) {
    payload = await requestNearbyPlaces(endpoint, key, signal);
  } else {
    const response = await fetchWithTimeout(endpoint, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store", redirect: "error", signal,
    }, 8000);
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error("Busca de lugares indisponível");
    }
    payload = await response.json();
  }
  const data = payload as { results?: unknown } | null;
  const results = data?.results ?? [];
  if (!Array.isArray(results)) throw new Error("Resposta de lugares inválida");
  const registry = createEvidenceRegistry();
  const seen = new Set<string>();
  const content: string[] = [];
  const ranked = results.flatMap(result => {
    if (!result || typeof result !== "object") return [];
    const item = result as Record<string, unknown>;
    const coordinate = coordinates(item.coordinates);
    const [latitude, longitude] = coordinate?.split(",").map(Number) ?? [];
    const distance = center && latitude !== undefined && longitude !== undefined
      ? distanceFrom(center, latitude, longitude) : Infinity;
    return center && distance > radius ? [] : [{ item, coordinate, distance }];
  });
  if (center) ranked.sort((a, b) => a.distance - b.distance);
  for (const { item, coordinate: validCoordinate } of ranked) {
    const name = cleanSearchText(item.title, 160);
    if (!name || !/\p{L}/u.test(name)) continue;
    const postal = item.postal_address as { displayAddress?: unknown } | null | undefined;
    const address = cleanSearchText(postal?.displayAddress, 250);
    // The location parameter biases results. Verify the returned address before linking.
    if (area && address && !addressMatchesArea(address, area)) continue;
    const coordinate = center || address ? validCoordinate : null;
    if (!matchesCategory(item, name, category)) continue;
    const identity = `${name.toLocaleLowerCase("pt-BR")}|${coordinate ?? address}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const mapLinks = coordinate ? createMapLinks(name, coordinate) : undefined;
    const website = placeWebsite(item.url);
    const url = website ?? mapLinks?.google;
    content.push(registry.add({
      id: `brave-place-${seen.size}`, title: name, author: website ? new URL(website).hostname : area ?? "Brave Search",
      external: true, sourceType: "place", matchedBy: "Brave Search · Lugares",
      ...(url ? { url } : {}),
      evidence: address || null, ...(mapLinks ? { mapLinks } : {}),
    }, JSON.stringify({ name, address: address || undefined, hasMapLinks: Boolean(mapLinks) })));
    if (content.length === 5) break;
  }
  return { sources: registry.sources, content: content.join("\n") };
}
