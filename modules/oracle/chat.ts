import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { openRouterChat } from "@/lib/openrouter-chat";

export function usesMaritaca() {
  return process.env.ORACLE_CHAT_PROVIDER === "maritaca";
}

function maritacaKey() {
  return process.env.MARITACA_API_KEY?.trim() || process.env.key_maritaca_ai?.trim();
}

export function hasOracleChatKey(openRouterKey?: string) {
  return Boolean(usesMaritaca() ? maritacaKey() : openRouterKey);
}

export function oracleChat(options: Parameters<typeof openRouterChat>[0]) {
  if (!usesMaritaca()) return openRouterChat(options);

  const key = maritacaKey();
  if (!key) return Promise.resolve(Response.json({ error: "Chave da Maritaca indisponível." }, { status: 503 }));
  const { messages, stream, max_tokens } = options.body;
  return fetchWithTimeout("https://chat.maritaca.ai/api/chat/completions", {
    method: "POST",
    signal: options.signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "S5-free", messages, stream, max_tokens, reasoning_effort: "none",
      ...(stream ? { stream_options: { include_usage: true } } : {}) }),
  }, options.timeoutMs ?? 60000);
}
