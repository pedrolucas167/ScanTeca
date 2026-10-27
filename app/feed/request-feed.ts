export type FeedResult<T> =
  | { kind: "success"; posts: T[] }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

export async function requestFeed<T>(signal?: AbortSignal): Promise<FeedResult<T>> {
  let response: Response;
  try {
    response = await fetch("/api/feed", { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "error", message: "Não conseguimos conectar ao feed. Verifique sua conexão e tente novamente." };
  }
  if (response.status === 401) return { kind: "unauthorized" };
  const failure = { kind: "error" as const, message: "O feed está indisponível no momento. Tente novamente em instantes." };
  if (!response.ok) return failure;
  try {
    const data = await response.json();
    if (!Array.isArray(data.posts)) return failure;
    return { kind: "success", posts: data.posts };
  } catch (error) {
    if (signal?.aborted) throw error;
    return failure;
  }
}
