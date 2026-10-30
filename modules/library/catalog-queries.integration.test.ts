import { afterAll, beforeAll, expect, it, vi } from "vitest";
const measured = vi.hoisted(() => ({ statements: [] as string[] }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Dedicated database required");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Only the disposable database is allowed");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: raw }), log: [{ emit: "event", level: "query" }] });
  prisma.$on("query", event => measured.statements.push(event.query));
  return { prisma };
});
import { prisma } from "@/lib/prisma";
import { getCatalog, getLibrarySettings } from "./queries";
const userId = "catalog-query-count-fixture";
async function cleanup() {
  await prisma.book.deleteMany({ where: { userId } });
  await prisma.collection.deleteMany({ where: { userId } });
  await prisma.librarySetting.deleteMany({ where: { userId } });
}
beforeAll(async () => {
  await cleanup();
  const collection = await prisma.collection.create({ data: { userId, name: "Synthetic" } });
  await prisma.librarySetting.create({ data: { userId, name: "Preserved library", accentTheme: "vinho" } });
  await prisma.book.createMany({ data: Array.from({ length: 68 }, (_, i) => ({ userId, collectionId: collection.id, isbn: `query-count-${i}`, title: `Book ${i}`, author: "Synthetic" })) });
});
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

it("configurações existentes usam um único SELECT real", async () => {
  measured.statements.length = 0;
  expect(await getLibrarySettings(userId)).toMatchObject({ name: "Preserved library", accentTheme: "vinho" });
  expect(measured.statements).toHaveLength(1);
  expect(measured.statements[0]).toMatch(/^SELECT/);
});

it("catálogo com 68 livros usa três comandos sem transação de escrita", async () => {
  measured.statements.length = 0;
  const catalog = await getCatalog(userId);
  expect(catalog.books).toHaveLength(68);
  expect(catalog.setting.name).toBe("Preserved library");
  expect(measured.statements).toHaveLength(3);
  expect(measured.statements.every(query => query.startsWith("SELECT"))).toBe(true);
});
