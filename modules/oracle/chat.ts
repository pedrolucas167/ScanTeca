import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { openRouterChat } from "@/lib/openrouter-chat";

export function usesMaritaca() {
  return process.env.NODE_ENV === "development" && process.env.ORACLE_CHAT_PROVIDER === "maritaca";
}

function maritacaKey() {
  return (process.env.MARITACA_API_KEY || process.env.key_maritaca_ai)?.trim();
}

export function hasOracleChatKey(openRouterKey?: string) {
  return Boolean(usesMaritaca() ? maritacaKey() : openRouterKey);
}

export function oracleChat(options: Parameters<typeof openRouterChat>[0]) {
  if (!usesMaritaca()) return openRouterChat(options);

  const key = maritacaKey();
  if (!key) return Promise.resolve(Response.json({ error: "Chave da Maritaca indisponível." }, { status: 503 }));
  return fetchWithTimeout("https://chat.maritaca.ai/api/chat/completions", {
    method: "POST",
    signal: options.signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...options.body, model: "S5-free", reasoning_effort: "none" }),
  }, options.timeoutMs ?? 60000);
}
