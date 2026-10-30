import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("@/lib/prisma", async () => {
  const { createPrismaClient } = await import("@/lib/prisma-client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina o banco local isolado de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Banco de testes inválido.");
  return { prisma: createPrismaClient(raw) };
});
vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { updateLibrarySettings, settingsSchema } from "@/modules/library";
import { updateReaderProfile } from "./profile";

const userId = "oracle-profile-integration-owner";
const other = "oracle-profile-integration-other";
const response = () => Response.json({ choices: [{ finish_reason: "stop", message: { content: "Perfil automático atrasado" } }] });
const input = () => ({ userId, snapshot: { oracleProfile: "Perfil inicial", oracleMemoryEnabled: true, oracleProfileVersion: 0 },
  question: "Prefiro ficção", apiKey: "fixture", model: "fixture", signal: new AbortController().signal });

beforeEach(async () => {
  vi.mocked(fetchWithTimeout).mockReset();
  await prisma.librarySetting.deleteMany({ where: { userId: { in: [userId, other] } } });
  await prisma.librarySetting.create({ data: { userId, oracleProfile: "Perfil inicial" } });
});
afterAll(() => prisma.$disconnect());

describe("reader control wins over background learning in PostgreSQL", () => {
  it("migrates existing profiles while preserving content and default behavior", async () => {
    const migration = readFileSync(new URL("../../prisma/migrations/20261030230000_oracle_memory_controls/migration.sql", import.meta.url), "utf8");
    await expect(prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE SCHEMA oracle_memory_migration_fixture');
      await tx.$executeRawUnsafe('CREATE TABLE oracle_memory_migration_fixture."LibrarySetting" ("oracleProfile" TEXT)');
      await tx.$executeRawUnsafe("INSERT INTO oracle_memory_migration_fixture.\"LibrarySetting\" VALUES ('Perfil existente')");
      await tx.$executeRawUnsafe('SET LOCAL search_path TO oracle_memory_migration_fixture');
      await tx.$executeRawUnsafe(migration);
      const rows = await tx.$queryRaw<{ oracleProfile: string; oracleMemoryEnabled: boolean; oracleProfileVersion: number }[]>`SELECT * FROM "LibrarySetting"`;
      expect(rows).toEqual([{ oracleProfile: "Perfil existente", oracleMemoryEnabled: true, oracleProfileVersion: 0 }]);
      throw new Error("rollback-migration-fixture");
    })).rejects.toThrow("rollback-migration-fixture");
  });
  it.each([false, true])("does not overwrite a manual change or deletion (forget: %s)", async forget => {
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { started = resolve; });
    vi.mocked(fetchWithTimeout).mockImplementationOnce(async () => { started(); await waiting; return response(); });
    const learning = updateReaderProfile(input());
    await ready;
    await updateLibrarySettings(userId, settingsSchema.parse({ oracleProfile: forget ? null : "Escolha manual", oracleProfileVersion: 0 }));
    release();
    await learning;
    expect(await prisma.librarySetting.findUnique({ where: { userId } })).toMatchObject({
      oracleProfile: forget ? null : "Escolha manual", oracleMemoryEnabled: !forget, oracleProfileVersion: 1,
    });
  });
  it("allows only one background update for the same version", async () => {
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response());
    await Promise.all([updateReaderProfile(input()), updateReaderProfile(input())]);
    expect(await prisma.librarySetting.findUnique({ where: { userId } })).toMatchObject({ oracleProfileVersion: 1 });
  });
  it("initializes missing settings without losing the generated preference", async () => {
    await prisma.librarySetting.delete({ where: { userId } });
    vi.mocked(fetchWithTimeout).mockImplementation(async () => response());
    const value = input();
    await updateReaderProfile({ ...value, snapshot: { ...value.snapshot, oracleProfile: null } });
    expect(await prisma.librarySetting.findUnique({ where: { userId } })).toMatchObject({
      oracleProfile: "Perfil automático atrasado", oracleMemoryEnabled: true, oracleProfileVersion: 1,
    });
  });
  it("isolates owners and rejects a stale manual edit", async () => {
    await updateLibrarySettings(other, settingsSchema.parse({ oracleProfile: "Outro leitor", oracleProfileVersion: 0 }));
    expect(await prisma.librarySetting.findUnique({ where: { userId } })).toMatchObject({ oracleProfile: "Perfil inicial" });
    await expect(updateLibrarySettings(other, settingsSchema.parse({ oracleProfile: "Rascunho atrasado", oracleProfileVersion: 0 }))).rejects.toThrow("memória mudou");
    expect(await prisma.librarySetting.findUnique({ where: { userId: other } })).toMatchObject({ oracleProfile: "Outro leitor" });
  });
});
