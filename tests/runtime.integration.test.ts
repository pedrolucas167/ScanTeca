import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ auth: vi.fn(), after: [] as (() => Promise<void>)[], scrape: vi.fn() }));
vi.mock("next/server", async importOriginal => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: (callback: () => Promise<void>) => { hooks.after.push(callback); },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: hooks.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitGuard: async () => null }));
vi.mock("@/lib/scrapers/wikipedia", () => ({ wikipediaScraper: { scrapeArticle: hooks.scrape } }));
vi.mock("@/lib/embeddings", () => ({ generateEmbedding: async () => null, externalDataToEmbeddingText: () => "test" }));
vi.mock("@/lib/redis", async () => {
  const { localRedis } = await import("./redis-client");
  return { getRedis: () => localRedis().client };
});
vi.mock("@/lib/prisma", async () => {
  const { createPrismaClient } = await import("@/lib/prisma-client");
  const raw = process.env.SCANTECA_TEST_DATABASE_URL;
  if (!raw) throw new Error("Defina a base isolada de testes.");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/scanteca_reading_test") throw new Error("Base de integração não permitida.");
  return { prisma: createPrismaClient(raw) };
});
import { NextRequest } from "next/server";
import { localRedis } from "./redis-client";
import { prisma } from "@/lib/prisma";
import { scrapingQueue } from "@/lib/scraping-queue";
import { ScrapingWorker } from "@/lib/scraping-worker";
import { POST as enqueue } from "@/app/api/scraping/enqueue/route";
import { GET as cron } from "@/app/api/cron/scraping/route";
import { POST as membership, PATCH as editClub } from "@/app/api/book-clubs/[id]/route";
import vercelConfig from "@/vercel.json";
const { command } = localRedis();
const clubId = "runtime-test-club";
const userId = "runtime-test-user";
const params = { params: Promise.resolve({ id: clubId }) };
const request = (path: string, method: string, body: unknown) => new NextRequest(`http://localhost${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(async () => {
  hooks.auth.mockReset().mockResolvedValue({ userId });
  hooks.scrape.mockReset().mockResolvedValue({ title: "Livro de teste", content: "Conteúdo controlado" });
  hooks.after.length = 0;
  vi.stubEnv("CRON_SECRET", "isolated-cron-test");
  await command("DEL", "scraping:queue", "scraping:processing", "scraping:results", "scraping:leases", "scraping:delayed", "scraping:scan-cursor");
  await prisma.externalResearchData.deleteMany({ where: { userId } });
  await prisma.bookClub.deleteMany({ where: { id: clubId } });
  await prisma.bookClub.create({ data: { id: clubId, name: "Runtime", maxMembers: 2, members: { create: { userId: "owner", role: "OWNER" } } } });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.externalResearchData.deleteMany({ where: { userId } });
  await prisma.bookClub.deleteMany({ where: { id: clubId } });
  await prisma.$disconnect();
});
async function enqueueJob() {
  const response = await enqueue(request("/api/scraping/enqueue", "POST", { url: "https://pt.wikipedia.org/wiki/Livro", source: "wikipedia", type: "article" }));
  expect(response.status).toBe(201);
  return (await response.json()).jobId as string;
}
const cronRequest = (authorized = true) => new NextRequest("http://localhost/api/cron/scraping", { headers: authorized ? { authorization: "Bearer isolated-cron-test" } : {} });
describe("handlers HTTP e worker com armazenamento real", () => {
  it("enqueue 201 agenda after, que usa claim novo e persiste o resultado no PostgreSQL", async () => {
    const id = await enqueueJob();
    expect(await scrapingQueue.getQueueSize()).toBe(1);
    expect(hooks.after).toHaveLength(1);
    await hooks.after[0]!();
    expect(await scrapingQueue.getResult(id)).toMatchObject({ jobId: id, success: true });
    expect(await prisma.externalResearchData.findUnique({ where: { id: `scraping_${id}` } })).toMatchObject({ userId, title: "Livro de teste" });
    expect(await scrapingQueue.getProcessingCount()).toBe(0);
  });
  it("cron rejeita acesso anônimo e dois workers concorrentes persistem uma única vez", async () => {
    expect(vercelConfig.crons).toContainEqual({ path: "/api/cron/scraping", schedule: "0 13 * * *" });
    const id = await enqueueJob();
    expect((await cron(cronRequest(false))).status).toBe(401);
    expect(await scrapingQueue.getQueueSize()).toBe(1);
    const [response, other] = await Promise.all([cron(cronRequest()), new ScrapingWorker().runOnce()]);
    const body = await response.json();
    expect([body.outcome, other].sort()).toEqual(["completed", "idle"]);
    expect(await prisma.externalResearchData.count({ where: { id: `scraping_${id}` } })).toBe(1);
    expect(hooks.scrape).toHaveBeenCalledTimes(1);
  });
  it("callbacks de enqueues concorrentes não são descartados por estado local do worker", async () => {
    const ids = await Promise.all([enqueueJob(), enqueueJob()]);
    expect(hooks.after).toHaveLength(2);
    await Promise.all(hooks.after.map(callback => callback()));
    expect(await prisma.externalResearchData.count({ where: { userId } })).toBe(2);
    for (const id of ids) expect(await scrapingQueue.getResult(id)).toMatchObject({ success: true });
  });
  it("cron recupera tentativa abandonada e falha HTTP externa fica em backoff", async () => {
    const id = await enqueueJob();
    const abandoned = (await scrapingQueue.dequeue())!;
    await command("ZADD", "scraping:leases", 0, id);
    await cron(cronRequest());
    await command("EVAL", "for _,v in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do redis.call('ZADD', KEYS[1], 0, v) end return 1", 1, "scraping:delayed");
    hooks.scrape.mockRejectedValueOnce(new Error("upstream unavailable"));
    const response = await cron(cronRequest());
    expect(await response.json()).toMatchObject({ ok: true, outcome: "retry" });
    expect(await command("ZCARD", "scraping:delayed")).toBe(1);
    expect(await scrapingQueue.getResult(id)).toBeNull();
    expect(await scrapingQueue.completeJob(id, { jobId: id, success: true, completedAt: Date.now() }, abandoned.claimToken)).toBe(false);
    expect(await prisma.externalResearchData.count({ where: { userId } })).toBe(0);
    await command("EVAL", "for _,v in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do redis.call('ZADD', KEYS[1], 0, v) end return 1", 1, "scraping:delayed");
    hooks.scrape.mockRejectedValueOnce(new Error("upstream still unavailable"));
    expect(await (await cron(cronRequest())).json()).toMatchObject({ outcome: "failed" });
    expect(await scrapingQueue.getResult(id)).toMatchObject({ success: false, error: "upstream still unavailable" });
    expect(await command("ZCARD", "scraping:delayed")).toBe(0);
  });
  it("POSTs concorrentes retornam 200/400 e PATCH rejeita capacidade abaixo da ocupação", async () => {
    hooks.auth.mockResolvedValueOnce({ userId: "a" }).mockResolvedValueOnce({ userId: "b" });
    const responses = await Promise.all([membership(request("/api/book-clubs/test", "POST", { action: "join" }), params), membership(request("/api/book-clubs/test", "POST", { action: "join" }), params)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await responses.find(r => r.status === 400)!.json()).toEqual({ error: "Clube cheio" });
    hooks.auth.mockResolvedValue({ userId: "owner" });
    const patch = await editClub(request("/api/book-clubs/test", "PATCH", { maxMembers: 1 }), params);
    expect(patch.status).toBe(400);
    expect(await prisma.bookClubMember.count({ where: { clubId } })).toBe(2);
    expect((await prisma.bookClub.findUniqueOrThrow({ where: { id: clubId } })).maxMembers).toBe(2);
  });
});
