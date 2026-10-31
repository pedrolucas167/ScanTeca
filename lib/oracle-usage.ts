export interface OracleUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
}

export function parseOracleUsage(value: unknown): OracleUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const count = (item: unknown) => typeof item === "number" && Number.isSafeInteger(item) && item >= 0 ? item : null;
  const inputTokens = count(data.prompt_tokens);
  const outputTokens = count(data.completion_tokens);
  const costUsd = typeof data.cost === "number" && Number.isFinite(data.cost) && data.cost >= 0 ? data.cost : null;
  return inputTokens === null && outputTokens === null && costUsd === null ? null : { inputTokens, outputTokens, costUsd };
}
