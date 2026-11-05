import { fetchWithTimeout } from "./fetch-with-timeout";
import { getRedis } from "./redis";
import { createModelPool, parseFreeModels, PoolUnavailable, FREE_MODELS_WITH_OPTIONAL_REASONING } from "./openrouter-pool";

export type ModelAttempt = { model: string; status: number; durationMs: number };

/** Free rotation is opt-in per environment; fixed/production callers keep their configured model. */
export async function openRouterChat({ apiKey, body, signal, timeoutMs = 60000, onAttempt }: {
  apiKey: string; body: Record<string, unknown>; signal?: AbortSignal; timeoutMs?: number;
  onAttempt?: (attempt: ModelAttempt) => void;
}) {
  const combined = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)]);
  const configured = process.env.ORACLE_FREE_MODELS?.trim();
  const models = configured ? parseFreeModels(configured) : null;
  const positiveLimit = (value: string | undefined, fallback: number, maximum: number) => {
    if (value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum) throw new Error("Invalid free pool request limit");
    return number;
  };
  const pool = models ? createModelPool({ apiKey, models, redis: getRedis(),
    rpm: positiveLimit(process.env.ORACLE_FREE_RPM, 20, 20), daily: positiveLimit(process.env.ORACLE_FREE_DAILY_LIMIT, 50, 1000) }) : null;
  const attempts = pool ? Math.min(models!.length, 2) : 1;
  for (let index = 0; index < attempts; index++) {
    combined.throwIfAborted();
    let model: string;
    try { model = pool ? await pool.reserve() : String(body.model); }
    catch (error) {
      if (error instanceof PoolUnavailable) return Response.json({ error: "Modelos gratuitos temporariamente indisponíveis." }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
      // Shared state failures must not silently create independent quotas in production.
      return Response.json({ error: "Não foi possível consultar os modelos gratuitos." }, { status: 503 });
    }
    const started = performance.now();
    const requestBody: Record<string, unknown> = { ...body, model };
    if (pool) {
      // Caller-provided fallback lists must never introduce a paid model.
      delete requestBody.models;
      delete requestBody.route;
      requestBody.provider = { max_price: { prompt: 0, completion: 0 }, allow_fallbacks: true };
      if (FREE_MODELS_WITH_OPTIONAL_REASONING.has(model)) requestBody.reasoning = { enabled: false };
    }
    let response: Response;
    try {
      response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", signal: combined,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", "X-Title": "Scanteca Oráculo" },
        body: JSON.stringify(requestBody),
      }, timeoutMs);
    } catch (error) {
      onAttempt?.({ model, status: 0, durationMs: Math.round(performance.now() - started) });
      if (!pool || combined.aborted || index + 1 === attempts) throw error;
      await pool.cooldown(model, 30);
      continue;
    }
    onAttempt?.({ model, status: response.status, durationMs: Math.round(performance.now() - started) });
    if (!pool || response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
    const retryHeader = response.headers.get("Retry-After");
    const parsedRetry = retryHeader ? Number(retryHeader) || Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000) : 30;
    const retry = Number.isFinite(parsedRetry) ? Math.max(1, parsedRetry) : 30;
    let upstreamLimit = false;
    if (response.status === 429) {
      try {
        const data = await response.clone().json();
        upstreamLimit = typeof data?.error?.metadata?.provider_name === "string";
      } catch { /* Unknown scope is treated as an account-wide limit. */ }
    }
    const global = response.status === 429 && !upstreamLimit;
    await pool.cooldown(model, retry, global);
    if (global || index + 1 === attempts) return response;
    await response.body?.cancel().catch(() => undefined);
  }
  throw new Error("Free model pool exhausted");
}
