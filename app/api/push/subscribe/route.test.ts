import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimitGuard: vi.fn(),
  rateLimits: {
    "push/subscribe": { userLimit: 10, ipLimit: 30, windowMs: 60_000 },
  },
}));
vi.mock("@/lib/error-report", () => ({ reportError: vi.fn() }));

import { POST, DELETE } from "./route";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard } from "@/lib/rate-limit";

const authMock = vi.mocked(auth);
const upsertMock = vi.mocked(prisma.pushSubscription.upsert);
const deleteMock = vi.mocked(prisma.pushSubscription.deleteMany);
const guardMock = vi.mocked(rateLimitGuard);

const subscription = {
  endpoint: "https://push.example.com/sub/abc",
  keys: { p256dh: "key-p256dh", auth: "key-auth" },
};

function makeRequest(method = "POST", body?: unknown) {
  return new NextRequest("http://localhost/api/push/subscribe", {
    method,
    headers: {
      "content-type": "application/json",
      "user-agent": "TestBrowser/1.0",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMock.mockResolvedValue(null);
    upsertMock.mockResolvedValue({} as never);
  });

  it("retorna 401 sem autenticação", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await POST(makeRequest("POST", subscription));

    expect(res.status).toBe(401);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("faz upsert da inscrição com userId e userAgent", async () => {
    authMock.mockResolvedValue({ userId: "u1" } as never);

    const res = await POST(makeRequest("POST", subscription));

    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint },
      update: expect.objectContaining({
        userId: "u1",
        p256dh: "key-p256dh",
        auth: "key-auth",
        userAgent: "TestBrowser/1.0",
      }),
      create: expect.objectContaining({
        userId: "u1",
        endpoint: subscription.endpoint,
      }),
    });
  });

  it("rejeita payload inválido", async () => {
    authMock.mockResolvedValue({ userId: "u1" } as never);

    const res = await POST(makeRequest("POST", { endpoint: "not-a-url" }));

    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 quando o banco falha", async () => {
    authMock.mockResolvedValue({ userId: "u1" } as never);
    upsertMock.mockRejectedValue(new Error("db down"));

    const res = await POST(makeRequest("POST", subscription));

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockResolvedValue({ count: 1 } as never);
  });

  it("retorna 401 sem autenticação", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await DELETE(
      makeRequest("DELETE", { endpoint: subscription.endpoint })
    );

    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("remove a inscrição apenas do próprio usuário", async () => {
    authMock.mockResolvedValue({ userId: "u1" } as never);

    const res = await DELETE(
      makeRequest("DELETE", { endpoint: subscription.endpoint })
    );

    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { endpoint: subscription.endpoint, userId: "u1" },
    });
  });
});
