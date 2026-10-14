// Bounds each provider request, including response-body consumption.
export function fetchWithTimeout(url: string | URL, options: RequestInit = {}, timeoutMs = 8000) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return fetch(url, {
    ...options,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  });
}
