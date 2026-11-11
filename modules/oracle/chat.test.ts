import { afterEach, expect, it, vi } from "vitest";
import { oracleChat, hasOracleChatKey } from "./chat";
import { openRouterChat } from "@/lib/openrouter-chat";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

vi.mock("@/lib/openrouter-chat", () => ({ openRouterChat: vi.fn() }));
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("mantém S5-free em produção e retorna limite de cota sem trocar de provedor", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
  vi.stubEnv("MARITACA_API_KEY", "");
  vi.stubEnv("key_maritaca_ai", "fixture");
  vi.mocked(fetchWithTimeout).mockResolvedValue(new Response(null, { status: 429 }));
  const response = await oracleChat({ apiKey: "other-provider", body: {
    model: "paid-model", temperature: 0.3, stream: true, messages: [],
  } });
  expect(response.status).toBe(429);
  expect(fetchWithTimeout).toHaveBeenCalledOnce();
  const body = JSON.parse(String(vi.mocked(fetchWithTimeout).mock.calls[0]?.[1]?.body));
  expect(body).toMatchObject({ model: "S5-free", stream_options: { include_usage: true } });
  expect(body).not.toHaveProperty("temperature");
  expect(openRouterChat).not.toHaveBeenCalled();
});

it("retorna indisponibilidade se a chave Maritaca estiver ausente", async () => {
  vi.stubEnv("ORACLE_CHAT_PROVIDER", "maritaca");
  vi.stubEnv("MARITACA_API_KEY", "");
  vi.stubEnv("key_maritaca_ai", "");
  expect(hasOracleChatKey("other-provider")).toBe(false);
  expect((await oracleChat({ apiKey: "other-provider", body: {} })).status).toBe(503);
  expect(fetchWithTimeout).not.toHaveBeenCalled();
  expect(openRouterChat).not.toHaveBeenCalled();
});

it("preserva o provedor existente quando a Maritaca não está selecionada", async () => {
  vi.stubEnv("ORACLE_CHAT_PROVIDER", "");
  vi.mocked(openRouterChat).mockResolvedValue(new Response(null, { status: 200 }));
  const options = { apiKey: "fixture", body: { model: "fixture-model" } };
  expect((await oracleChat(options)).status).toBe(200);
  expect(openRouterChat).toHaveBeenCalledWith(options);
});
