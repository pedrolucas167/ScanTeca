import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ userId: "access-test-viewer" as string | null, moderate: vi.fn(), notify: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: mocks.userId }), currentUser: async () => ({ fullName: "Leitor" }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: async () => null, rateLimits: {} }));
vi.mock("@/lib/moderation", () => ({ moderateContent: mocks.moderate }));
vi.mock("@/lib/social-notifications", () => ({ createSocialNotification: mocks.notify }));
vi.mock("@/lib/prisma", async () => {
  const { createPrismaClient } = await import("@/lib/prisma-client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina a base isolada de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Base de integração não permitida.");
  return { prisma: createPrismaClient(raw) };
});
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GET as feed, POST as post } from "@/app/api/feed/route";
import { POST as reply } from "@/app/api/books/[id]/discussions/[discussionId]/replies/route";
import { GET as discussions } from "@/app/api/books/[id]/discussions/route";
const viewer = "access-test-viewer";
const author = "access-test-author";
let originalId: string;
let bookId: string;
let discussionId: string;
const scope = { startsWith: "access-test-" };
const request = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
async function clean() {
  await prisma.feedPost.deleteMany({ where: { userId: scope } });
  await prisma.socialFollow.deleteMany({ where: { followerId: scope } });
  await prisma.socialBlock.deleteMany({ where: { blockerId: scope } });
  await prisma.socialProfile.deleteMany({ where: { userId: scope } });
  await prisma.book.deleteMany({ where: { userId: scope } });
  await prisma.collection.deleteMany({ where: { userId: scope } });
  await prisma.librarySetting.deleteMany({ where: { userId: scope } });
}
beforeEach(async () => {
  mocks.userId = viewer;
  mocks.moderate.mockReset().mockResolvedValue({ approved: true, flagged: false });
  mocks.notify.mockReset().mockResolvedValue(undefined);
  await clean();
  await prisma.socialProfile.create({ data: { userId: author, visibility: "PUBLIC" } });
  originalId = (await prisma.feedPost.create({ data: { userId: author, content: "CONTEÚDO RESTRITO", moderationStatus: "APPROVED" } })).id;
  const collection = await prisma.collection.create({ data: { userId: author, name: "Livros" } });
  bookId = (await prisma.book.create({ data: { userId: author, isbn: "test-isbn", title: "Livro", author: "Autor", collectionId: collection.id } })).id;
  discussionId = (await prisma.bookDiscussion.create({ data: { bookId, userId: author, title: "Discussão", content: "Conteúdo" } })).id;
  await prisma.librarySetting.create({ data: { userId: author, shareEnabled: false } });
});
afterAll(async () => { await clean(); await prisma.$disconnect(); });
const quote = () => post(request("/api/feed", { content: "Minha publicação", quotedPostId: originalId }));
const answer = (id = bookId) => reply(request("/api/books/test/discussions/test/replies", { content: "Resposta" }), { params: Promise.resolve({ id, discussionId }) });
describe("autorização de citações e respostas pelos handlers", () => {
  it.each(["PRIVATE", "FOLLOWERS"] as const)("recusa citação de perfil %s sem acesso, sem gravar nem moderar", async visibility => {
    await prisma.socialProfile.update({ where: { userId: author }, data: { visibility } });
    const response = await quote();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Publicação não encontrada" });
    expect(await prisma.feedPost.count({ where: { userId: viewer } })).toBe(0);
    expect(mocks.moderate).not.toHaveBeenCalled();
  });
  it.each(["PENDING", "FLAGGED", "REJECTED"] as const)("recusa citação de post %s de outro usuário", async moderationStatus => {
    await prisma.feedPost.update({ where: { id: originalId }, data: { moderationStatus } });
    expect((await quote()).status).toBe(404);
  });
  it("permite seguidor autorizado e revalida quando deixa de seguir", async () => {
    await prisma.socialProfile.update({ where: { userId: author }, data: { visibility: "FOLLOWERS" } });
    await prisma.socialFollow.create({ data: { followerId: viewer, followingId: author } });
    const created = await quote();
    expect(created.status).toBe(201);
    expect((await created.json()).post.quotedPost.text).toBe("CONTEÚDO RESTRITO");
    await prisma.socialFollow.deleteMany({ where: { followerId: viewer } });
    const response = await feed(new NextRequest("http://localhost/api/feed"));
    const payload = await response.json();
    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0].quotedPost).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("CONTEÚDO RESTRITO");
  });
  it.each(["private", "rejected", "blocked"])("oculta citações existentes após mudança: %s", async change => {
    expect((await quote()).status).toBe(201);
    if (change === "private") await prisma.socialProfile.update({ where: { userId: author }, data: { visibility: "PRIVATE" } });
    if (change === "rejected") await prisma.feedPost.update({ where: { id: originalId }, data: { moderationStatus: "REJECTED" } });
    if (change === "blocked") await prisma.socialBlock.create({ data: { blockerId: viewer, blockedId: author } });
    const payload = await (await feed(new NextRequest("http://localhost/api/feed"))).json();
    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0].quotedPost).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("CONTEÚDO RESTRITO");
    expect((await quote()).status).toBe(404);
  });
  it("revalida antes de retornar POST quando a permissão muda durante moderação", async () => {
    mocks.moderate.mockImplementation(async () => {
      await prisma.socialProfile.update({ where: { userId: author }, data: { visibility: "PRIVATE" } });
      return { approved: true, flagged: false };
    });
    const response = await quote();
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.post.quotedPost).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("CONTEÚDO RESTRITO");
  });
  it("recusa respostas privadas sem gravar ou notificar; o dono continua autorizado", async () => {
    expect((await answer()).status).toBe(404);
    expect(await prisma.bookDiscussionReply.count({ where: { discussionId } })).toBe(0);
    expect(mocks.notify).not.toHaveBeenCalled();
    mocks.userId = author;
    expect((await answer()).status).toBe(201);
  });
  it("listagem e resposta perdem acesso juntas após revogar compartilhamento", async () => {
    await prisma.librarySetting.update({ where: { userId: author }, data: { shareEnabled: true } });
    expect((await answer()).status).toBe(201);
    mocks.notify.mockClear();
    await prisma.librarySetting.update({ where: { userId: author }, data: { shareEnabled: false } });
    expect((await answer()).status).toBe(404);
    expect((await discussions(new NextRequest("http://localhost/api/books/test/discussions"), { params: Promise.resolve({ id: bookId }) })).status).toBe(404);
    expect(await prisma.bookDiscussionReply.count({ where: { discussionId } })).toBe(1);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("conhecer discussão não permite associá-la a outro livro", async () => {
    mocks.userId = author;
    const other = await prisma.book.create({ data: { userId: author, isbn: "other-isbn", title: "Outro", author: "Autor", collectionId: (await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).collectionId } });
    expect((await answer(other.id)).status).toBe(404);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("mantém 401 para visitante sem sessão", async () => {
    mocks.userId = null;
    expect((await quote()).status).toBe(401);
    expect((await answer()).status).toBe(401);
  });
});
