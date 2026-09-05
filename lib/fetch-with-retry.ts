export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  baseDelay?: number;
  retryOn?: (response: Response) => boolean;
}

function isRetryable(res: Response): boolean {
  return res.status === 429 || res.status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { maxRetries = 3, baseDelay = 500, retryOn, ...fetchOptions } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, fetchOptions);

      const shouldRetry = retryOn ? retryOn(res) : isRetryable(res);
      if (shouldRetry && attempt < maxRetries) {
        const delay = baseDelay * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= maxRetries) break;

      const delay = baseDelay * 2 ** attempt;
      await sleep(delay);
    }
  }

  if (lastError) throw lastError;
  throw new Error("fetchWithRetry failed");
}
