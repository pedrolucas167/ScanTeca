import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { librarySetting: { findUnique: vi.fn(), upsert: vi.fn() } } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: { "library-settings": { userLimit: 30, ipLimit: 60, windowMs: 60000 } } }));
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard } from "@/lib/rate-limit";
import { POST } from "./route";
const request = (yearlyGoal: unknown) => new NextRequest("http://localhost/api/library-settings", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ yearlyGoal }),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: "u1" } as never);
  vi.mocked(rateLimitGuard).mockResolvedValue(null);
  vi.mocked(prisma.librarySetting.upsert).mockResolvedValue({ yearlyGoal: 24 } as never);
});
it("persiste a meta já na primeira criação das configurações", async () => {
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue(null);
  expect((await POST(request(24))).status).toBe(200);
  expect(prisma.librarySetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { userId: "u1" }, create: expect.objectContaining({ yearlyGoal: 24 }), update: { yearlyGoal: 24 },
  }));
  expect(rateLimitGuard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userLimit: 30, ipLimit: 60 }));
});
it("permite remover a meta existente", async () => {
  expect((await POST(request(null))).status).toBe(200);
  expect(prisma.librarySetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { yearlyGoal: null } }));
});
it.each([0, -1, 1.5, "24"])("rejeita meta inválida (%s)", async value => {
  expect((await POST(request(value))).status).toBe(400);
  expect(prisma.librarySetting.upsert).not.toHaveBeenCalled();
});
