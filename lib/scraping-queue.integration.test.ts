import { beforeEach, describe, expect, it } from "vitest";
import { ScrapingQueue } from "./scraping-queue";
import { localRedis } from "@/tests/redis-client";

const { client, command } = localRedis();
const queue = new ScrapingQueue(client, 120_000);
const input = { url: "https://pt.wikipedia.org/wiki/Livro", source: "wikipedia", type: "article" as const, priority: 10, maxAttempts: 2 };
beforeEach(async () => {
  await command("DEL", "scraping:queue", "scraping:processing", "scraping:results", "scraping:leases", "scraping:delayed", "scraping:scan-cursor");
});
async function expireClaim(id: string) {
  // Simula queda do worker sem depender do relógio/tempo de execução do teste.
  await command("ZADD", "scraping:leases", 0, id);
}
async function releaseBackoff() {
  await command("EVAL", "for _,v in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do redis.call('ZADD', KEYS[1], 0, v) end return 1", 1, "scraping:delayed");
}
describe("fila com Redis real", () => {
  it("reproduz claim duplicado com ZRANGE/ZREM separados", async () => {
    await queue.enqueue(input);
    const readers = await Promise.all([command("ZRANGE", "scraping:queue", 0, 0), command("ZRANGE", "scraping:queue", 0, 0)]) as string[][];
    expect(readers[0]![0]).toBe(readers[1]![0]);
    const removals = await Promise.all(readers.map(values => command("ZREM", "scraping:queue", values[0]!)));
    expect(removals.sort()).toEqual([0, 1]);
    // O consumidor antigo entregava o job lido mesmo quando ZREM retornava zero.
  });
  it("resposta perdida após claim não perde o job", async () => {
    const id = await queue.enqueue(input);
    const lostReply = { ...client, eval: async (...args: Parameters<typeof client.eval>) => {
      await client.eval(...args);
      throw new Error("Connection lost after commit");
    } };
    await expect(new ScrapingQueue(lostReply).dequeue()).rejects.toThrow("Connection lost");
    expect(await queue.getQueueSize()).toBe(0);
    expect(await queue.getProcessingCount()).toBe(1);
    await expireClaim(id);
    await queue.dequeue();
    await releaseBackoff();
    expect(await queue.dequeue()).toMatchObject({ id, attempts: 2 });
  });
  it("dois workers não recebem o mesmo job", async () => {
    await queue.enqueue(input);
    const claims = await Promise.all(Array.from({ length: 8 }, () => queue.dequeue()));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await queue.getProcessingCount()).toBe(1);
    expect(await queue.getQueueSize()).toBe(0);
  });
  it("recupera claim abandonado e rejeita conclusão do worker antigo", async () => {
    const id = await queue.enqueue(input);
    const old = (await queue.dequeue())!;
    await expireClaim(id);
    expect(await queue.dequeue()).toBeNull();
    expect(await command("ZCARD", "scraping:delayed")).toBe(1);
    await releaseBackoff();
    const next = (await queue.dequeue())!;
    expect(next.attempts).toBe(2);
    expect(next.claimToken).not.toBe(old.claimToken);
    const result = { jobId: id, success: true, completedAt: Date.now() };
    expect(await queue.completeJob(id, result, old.claimToken)).toBe(false);
    expect(await queue.failJob(id, "late", old.claimToken)).toBe(false);
    expect(await queue.completeJob(id, result, next.claimToken)).toBe(true);
    expect(await queue.completeJob(id, result, next.claimToken)).toBe(false);
    expect(await queue.getResult(id)).toEqual(result);
  });
  it("persiste backoff sem espera em memória e limita tentativas após quedas", async () => {
    const id = await queue.enqueue(input);
    const first = (await queue.dequeue())!;
    await Promise.all([queue.failJob(id, "network", first.claimToken), queue.failJob(id, "network", first.claimToken)]);
    expect(await queue.getResult(id)).toBeNull();
    expect(await queue.dequeue()).toBeNull();
    expect(await command("ZCARD", "scraping:delayed")).toBe(1);
    await releaseBackoff();
    expect((await queue.dequeue())?.attempts).toBe(2);
    await expireClaim(id);
    expect(await queue.dequeue()).toBeNull();
    expect(await queue.getResult(id)).toMatchObject({ success: false, jobId: id });
    expect(await queue.getProcessingCount()).toBe(0);
    expect(await command("TTL", "scraping:results")).toBeGreaterThan(0);
  });
  it("renova lease e recupera jobs do formato anterior", async () => {
    const legacy = { ...input, id: "legacy", createdAt: 1, attempts: 0 };
    await command("HSET", "scraping:processing", legacy.id, JSON.stringify(legacy));
    await queue.dequeue();
    expect(await command("ZCARD", "scraping:delayed")).toBe(1);
    await releaseBackoff();
    const job = (await queue.dequeue())!;
    expect(await queue.renewJob(job.id, job.claimToken)).toBe(true);
    expect(await queue.renewJob(job.id, "stale")).toBe(false);
  });
});
