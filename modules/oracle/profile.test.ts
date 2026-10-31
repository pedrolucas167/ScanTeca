import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { librarySetting: { createMany: vi.fn(), updateMany: vi.fn() } } }));
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { updateReaderProfile } from "./profile";

const input = () => ({ userId: "owner", snapshot: { oracleProfile: "Gosta de poesia", oracleMemoryEnabled: true, oracleProfileVersion: 3 },
  question: "Prefiro ficção científica agora", apiKey: "fixture", model: "fixture-model", signal: new AbortController().signal });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchWithTimeout).mockResolvedValue(Response.json({ choices: [{ finish_reason: "stop", message: { content: "Gosta de ficção científica" } }] }));
});

describe("reader profile learning", () => {
  it("skips provider and storage while learning is paused", async () => {
    const value = input();
    await updateReaderProfile({ ...value, snapshot: { ...value.snapshot, oracleMemoryEnabled: false } });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(prisma.librarySetting.updateMany).not.toHaveBeenCalled();
  });
  it("writes only if the owner, enabled state and version still match", async () => {
    await updateReaderProfile(input());
    expect(prisma.librarySetting.updateMany).toHaveBeenCalledWith({
      where: { userId: "owner", oracleMemoryEnabled: true, oracleProfileVersion: 3 },
      data: { oracleProfile: "Gosta de ficção científica", oracleProfileVersion: { increment: 1 } },
    });
    const body = JSON.parse(String(vi.mocked(fetchWithTimeout).mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain("somente preferências, autores, gêneros ou objetivos explicitamente declarados");
    expect(body.messages[0].content).not.toContain("Oráculo:");
  });
  it.each([
    ["SEM MUDANÇA", "stop"], ["Gosta de poesia", "stop"], ["Perfil incompleto", "length"], ["x".repeat(2001), "stop"],
  ])("does not persist unchanged, truncated or oversized output", async (content, finish_reason) => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(Response.json({ choices: [{ finish_reason, message: { content } }] }));
    await updateReaderProfile(input());
    expect(prisma.librarySetting.createMany).not.toHaveBeenCalled();
    expect(prisma.librarySetting.updateMany).not.toHaveBeenCalled();
  });
  it("does not save after cancellation during generation", async () => {
    const controller = new AbortController();
    vi.mocked(fetchWithTimeout).mockImplementationOnce(async () => {
      controller.abort();
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: "Novo perfil" } }] });
    });
    await updateReaderProfile({ ...input(), signal: controller.signal });
    expect(prisma.librarySetting.createMany).not.toHaveBeenCalled();
  });
});
