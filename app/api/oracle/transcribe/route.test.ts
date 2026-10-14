import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: { oracle: { userLimit: 15, ipLimit: 60 } } }));
import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import { POST } from "./route";
const provider = vi.fn();
const request = (data = "ZmljdGljaW8=") => new NextRequest("http://localhost/api/oracle/transcribe", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ audio: { data, format: "webm" } }),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "test-owner" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubGlobal("fetch", provider);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("returns only an editable transcript and calls only transcription", async () => {
  provider.mockResolvedValue(Response.json({ text: "  Quero revisar minha pergunta.  " }));
  expect(await (await POST(request())).json()).toEqual({ transcript: "Quero revisar minha pergunta." });
  expect(provider).toHaveBeenCalledTimes(1);
  expect(provider.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/audio/transcriptions");
});
it("blocks anonymous requests before sending audio", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  expect((await POST(request())).status).toBe(401);
  expect(provider).not.toHaveBeenCalled();
});
it("honors rate limiting before calling the provider", async () => {
  vi.mocked(rateLimitGuard).mockResolvedValue(Response.json({}, { status: 429 }) as never);
  expect((await POST(request())).status).toBe(429);
  expect(provider).not.toHaveBeenCalled();
});
it("rejects empty audio", async () => {
  expect((await POST(request(""))).status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
});
it("handles audio without detected speech", async () => {
  provider.mockResolvedValue(Response.json({ text: " " }));
  expect((await POST(request())).status).toBe(422);
});
it("handles provider connection failures", async () => {
  provider.mockRejectedValue(new Error("timeout"));
  expect((await POST(request())).status).toBe(502);
});
