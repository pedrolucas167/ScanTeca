import { buildRecommendations } from "./recommendations";
import { getRecommendationsSnapshot, setCachedRecommendations } from "./recommendations-cache";

// The optional cache must not add an unbounded dependency to page rendering.
async function cacheWithinBudget<T>(operation: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), 200); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Both the page and API must use the same versioned cache protocol.
export async function getRecommendations(userId: string) {
  const snapshot = await cacheWithinBudget(getRecommendationsSnapshot(userId), { payload: null, version: null });
  if (snapshot.payload) {
    return { data: snapshot.payload, cache: "HIT" as const };
  }

  const data = await buildRecommendations(userId);
  if (snapshot.version) {
    await cacheWithinBudget(setCachedRecommendations(userId, data, snapshot.version), false);
  }
  return { data, cache: "MISS" as const };
}
