import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prisma = { librarySetting: { findUnique: vi.fn(), upsert: vi.fn() }, $transaction: vi.fn() };
  prisma.$transaction.mockImplementation(async callback => callback(prisma));
  return { prisma };
});
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: vi.fn(), rateLimits: { "library-settings": { userLimit: 30, ipLimit: 60, windowMs: 60000 } } }));
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimitGuard } from "@/lib/rate-limit";
import { POST } from "./route";
const request = (yearlyGoal: unknown) => new NextRequest("http://localhost/api/library-settings", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ yearlyGoal }),
});
beforeEach(() => {
  vi.clearAllMocks();
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

const memoryRequest = (body: unknown) => new NextRequest("http://localhost/api/library-settings", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

it("apaga o perfil e pausa o aprendizado, invalidando atualizações automáticas", async () => {
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue({ oracleProfileVersion: 2 } as never);
  expect((await POST(memoryRequest({ oracleProfile: null, oracleProfileVersion: 2, userId: "other" }))).status).toBe(200);
  expect(prisma.librarySetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "u1" },
    update: { oracleProfile: null, oracleMemoryEnabled: false, oracleProfileVersion: { increment: 1 } },
  }));
});

it("preserva a memória ao pausar apenas o aprendizado", async () => {
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue({ oracleProfileVersion: 4 } as never);
  expect((await POST(memoryRequest({ oracleMemoryEnabled: false, oracleProfileVersion: 4 }))).status).toBe(200);
  expect(prisma.librarySetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
    update: { oracleMemoryEnabled: false, oracleProfileVersion: { increment: 1 } },
  }));
});

it("recusa edição de uma versão desatualizada", async () => {
  vi.mocked(prisma.librarySetting.findUnique).mockResolvedValue({ oracleProfileVersion: 5 } as never);
  expect((await POST(memoryRequest({ oracleProfile: "Meu rascunho", oracleProfileVersion: 4 }))).status).toBe(409);
  expect(prisma.librarySetting.upsert).not.toHaveBeenCalled();
});

it("exige autenticação para alterar a memória", async () => {
  vi.mocked(auth).mockResolvedValueOnce({ userId: null } as never);
  expect((await POST(memoryRequest({ oracleProfile: null }))).status).toBe(401);
  expect(prisma.librarySetting.upsert).not.toHaveBeenCalled();
});

it.each([{ oracleMemoryEnabled: "false" }, { oracleProfileVersion: -1 }, { oracleProfile: "x".repeat(2001) }])("rejeita controles de memória inválidos", async body => {
  expect((await POST(memoryRequest(body))).status).toBe(400);
  expect(prisma.librarySetting.upsert).not.toHaveBeenCalled();
});
