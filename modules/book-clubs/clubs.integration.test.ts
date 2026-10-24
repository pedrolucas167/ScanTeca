import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina a base local isolada de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Base de integração não permitida.");
  return { prisma: new PrismaClient({ datasourceUrl: raw }) };
});
import { prisma } from "@/lib/prisma";
import { BookClubError, changeMembership, updateBookClub } from "./service";
const id = "concurrency-test-club";
beforeEach(async () => {
  await prisma.bookClub.deleteMany({ where: { id } });
  await prisma.bookClub.create({ data: { id, name: "Clube", maxMembers: 2, members: { create: { userId: "owner", role: "OWNER" } } } });
});
afterAll(async () => { await prisma.bookClub.deleteMany({ where: { id } }); await prisma.$disconnect(); });
async function invariant() {
  const club = await prisma.bookClub.findUniqueOrThrow({ where: { id } });
  const count = await prisma.bookClubMember.count({ where: { clubId: id } });
  expect(count).toBeLessThanOrEqual(club.maxMembers!);
  return count;
}
describe("capacidade com PostgreSQL real", () => {
  it("reproduz o excesso de capacidade com check/create separados", async () => {
    const counts = await Promise.all([1, 2].map(() => prisma.bookClubMember.count({ where: { clubId: id } })));
    expect(counts).toEqual([1, 1]);
    await Promise.all(["a", "b"].map(userId => prisma.bookClubMember.create({ data: { clubId: id, userId } })));
    expect(await prisma.bookClubMember.count({ where: { clubId: id } })).toBe(3);
  });
  it("duas entradas disputando a última vaga preservam o limite", async () => {
    const results = await Promise.allSettled([changeMembership(id, "a", "join"), changeMembership(id, "b", "join")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { message: "Clube cheio", status: 400 } });
    expect(await invariant()).toBe(2);
  });
  it("entrada simultânea com redução de capacidade não viola a invariante", async () => {
    const results = await Promise.allSettled([changeMembership(id, "a", "join"), updateBookClub(id, "owner", { maxMembers: 1 })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    await invariant();
  });
  it("saída simultânea com redução é serializada e permite tentar novamente", async () => {
    await changeMembership(id, "a", "join");
    await Promise.allSettled([changeMembership(id, "a", "leave"), updateBookClub(id, "owner", { maxMembers: 1 })]);
    await updateBookClub(id, "owner", { maxMembers: 1 });
    expect(await invariant()).toBe(1);
  });
  it("entradas repetidas não escapam como violação de unique", async () => {
    const results = await Promise.allSettled([changeMembership(id, "a", "join"), changeMembership(id, "a", "join")]);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { message: "Já é membro" } });
    expect(await invariant()).toBe(2);
  });
  it("mantém permissões e faz rollback em rejeições", async () => {
    await expect(updateBookClub(id, "stranger", { name: "Outro" })).rejects.toMatchObject({ status: 403 });
    await expect(changeMembership(id, "owner", "leave")).rejects.toThrow("Dono não pode sair");
    await updateBookClub(id, "owner", { isPrivate: true });
    await expect(changeMembership(id, "a", "join")).rejects.toMatchObject({ status: 403 });
    await expect(changeMembership("missing", "a", "join")).rejects.toBeInstanceOf(BookClubError);
    expect(await invariant()).toBe(1);
    expect((await prisma.bookClub.findUniqueOrThrow({ where: { id } })).name).toBe("Clube");
  });
});
