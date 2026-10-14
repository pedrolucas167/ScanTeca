import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: {} }));
vi.mock("@/modules/reading", async importOriginal => ({
  ...await importOriginal<typeof import("@/modules/reading")>(),
  startReadingSession: vi.fn(), pauseReadingSession: vi.fn(), saveDiaryEntry: vi.fn(), deleteDiaryEntry: vi.fn(),
}));
import { auth } from "@clerk/nextjs/server";
import { rateLimitGuard } from "@/lib/rate-limit";
import { startReadingSession, pauseReadingSession, ReadingError } from "@/modules/reading";
import { POST } from "./route";

const id = "cmg12345678901234567890123";
const request = (body: unknown) => new NextRequest("http://localhost/api/diary", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
});
it("rejeita comando anônimo", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  expect((await POST(request({ action: "start", bookId: id }))).status).toBe(401);
  expect(startReadingSession).not.toHaveBeenCalled();
});
it("mantém rate limit antes da execução", async () => {
  vi.mocked(rateLimitGuard).mockResolvedValue(NextResponse.json({}, { status: 429 }));
  expect((await POST(request({ action: "start", bookId: id }))).status).toBe(429);
  expect(startReadingSession).not.toHaveBeenCalled();
});
it("valida página antes de executar pausa", async () => {
  expect((await POST(request({ action: "pause", sessionId: id, currentPage: -1 }))).status).toBe(400);
  expect(pauseReadingSession).not.toHaveBeenCalled();
});
it("preserva o contrato de início", async () => {
  vi.mocked(startReadingSession).mockResolvedValue({ id } as never);
  const response = await POST(request({ action: "start", bookId: id }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ session: { id } });
  expect(startReadingSession).toHaveBeenCalledWith("u1", id);
});
it.each([["NOT_FOUND", 404], ["CONFLICT", 409], ["INVALID_INPUT", 400]] as const)("traduz %s", async (code, status) => {
  vi.mocked(pauseReadingSession).mockRejectedValue(new ReadingError("erro", code));
  const response = await POST(request({ action: "pause", sessionId: id, currentPage: 20 }));
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: "erro" });
});
