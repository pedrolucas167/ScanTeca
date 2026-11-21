import { openRouterChat } from "@/lib/openrouter-chat";

export function hasOracleChatKey(openRouterKey?: string) {
  return Boolean(openRouterKey?.trim());
}

export function oracleChat(options: Parameters<typeof openRouterChat>[0]) {
  return openRouterChat(options);
}
