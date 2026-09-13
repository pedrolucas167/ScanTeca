import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({ isAdmin: vi.fn() }));
vi.mock("@/lib/push", () => ({
  pushConfigured: vi.fn(),
  sendPush: vi.fn(),
  logBroadcast: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitGuard: vi.fn(),
  rateLimits: {
    "admin/broadcast": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  },
}));
vi.mock("@/lib/error-report", () => ({ reportError: vi.fn() }));

import { POST } from "./route";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { pushConfigured, sendPush, logBroadcast } from "@/lib/push";
import { rateLimitGuard } from "@/lib/rate-limit";

const authMock = vi.mocked(auth);
const isAdminMock = vi.mocked(isAdmin);
const configuredMock = vi.mocked(pushConfigured);
const sendPushMock = vi.mocked(sendPush);
const logMock = vi.mocked(logBroadcast);
const guardMock = vi.mocked(rateLimitGuard);

const payload = { title: "Novidade", body: "Saiu feature nova" };

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/admin/broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "admin1" } as never);
    isAdminMock.mockResolvedValue(true);
    guardMock.mockResolvedValue(null);
    configuredMock.mockReturnValue(true);
    sendPushMock.mockResolvedValue({ sent: 3, failed: 0, removed: 1 });
    logMock.mockResolvedValue(undefined);
  });

  it("retorna 401 sem autenticação", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(401);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("retorna 403 para não-admin", async () => {
    isAdminMock.mockResolvedValue(false);

    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(403);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("retorna 503 quando VAPID não está configurado", async () => {
    configuredMock.mockReturnValue(false);

    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(503);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("broadcast normal envia pra todos com categoria updates", async () => {
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(sendPushMock).toHaveBeenCalledWith(payload, {
      userId: undefined,
      category: "updates",
    });
    expect(logMock).toHaveBeenCalledWith(
      "admin1",
      payload,
      { sent: 3, failed: 0, removed: 1 },
      false
    );
  });

  it("modo test envia só pro próprio admin", async () => {
    const res = await POST(makeRequest({ ...payload, test: true }));

    expect(res.status).toBe(200);
    expect(sendPushMock).toHaveBeenCalledWith(payload, {
      userId: "admin1",
      category: "updates",
    });
    expect(logMock).toHaveBeenCalledWith(
      "admin1",
      payload,
      { sent: 3, failed: 0, removed: 1 },
      true
    );
  });

  it("rejeita payload sem título", async () => {
    const res = await POST(makeRequest({ body: "só corpo" }));

    expect(res.status).toBe(400);
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
