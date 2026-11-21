import { afterEach, expect, it, vi } from "vitest";
import { oracleChat, hasOracleChatKey } from "./chat";
import { openRouterChat } from "@/lib/openrouter-chat";

vi.mock("@/lib/openrouter-chat", () => ({ openRouterChat: vi.fn() }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("usa OpenRouter mesmo se as antigas variáveis da Maritaca ainda existirem", async () => {
  vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
  vi.stubEnv("MARITACA_API_KEY", "fixture-maritaca");
  vi.stubEnv("key_maritaca_ai", "fixture-maritaca-legacy");
  vi.mocked(openRouterChat).mockResolvedValue(new Response(null, { status: 200 }));
  const options = { apiKey: "fixture-openrouter", body: { model: "fixture-model" } };
  expect(hasOracleChatKey(options.apiKey)).toBe(true);
  expect(hasOracleChatKey("")).toBe(false);
  expect((await oracleChat(options)).status).toBe(200);
  expect(openRouterChat).toHaveBeenCalledWith(options);
});
