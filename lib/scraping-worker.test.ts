import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dequeue: vi.fn(), complete: vi.fn(), fail: vi.fn(), renew: vi.fn(), scrape: vi.fn(), save: vi.fn() }));
vi.mock("./scraping-queue", () => ({ scrapingQueue: { dequeue: mocks.dequeue, completeJob: mocks.complete, failJob: mocks.fail, renewJob: mocks.renew, leaseMs: 120000 } }));
vi.mock("./scrapers/wikipedia", () => ({ wikipediaScraper: { scrapeArticle: mocks.scrape } }));
vi.mock("./prisma", () => ({ prisma: { externalResearchData: { upsert: mocks.save } } }));
vi.mock("./embeddings", () => ({ generateEmbedding: vi.fn().mockResolvedValue(null), externalDataToEmbeddingText: () => "text" }));
import { ScrapingWorker } from "./scraping-worker";
const job = { id: "job-test", claimToken: "token", leaseUntil: Date.now() + 120000, attempts: 1, maxAttempts: 2, url: "https://pt.wikipedia.org/wiki/Livro", source: "wikipedia", type: "article", userId: "test-user" };
function process(worker: ScrapingWorker) {
  return (worker as unknown as { processNextJob(): Promise<void> }).processNextJob();
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.dequeue.mockResolvedValue(job);
  mocks.renew.mockResolvedValue(true);
  mocks.scrape.mockResolvedValue({ title: "Livro", content: "Conteúdo" });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
describe("worker", () => {
  it("não completa uma falha que foi reagendada", async () => {
    mocks.scrape.mockRejectedValue(new Error("network"));
    await process(new ScrapingWorker());
    expect(mocks.fail).toHaveBeenCalledWith(job.id, "network", job.claimToken);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("falha de persistência também provoca retry", async () => {
    mocks.save.mockRejectedValue(new Error("database down"));
    await process(new ScrapingWorker());
    expect(mocks.fail).toHaveBeenCalledWith(job.id, "database down", job.claimToken);
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("reexecuções gravam pelo mesmo ID e não sobrescrevem o registro", async () => {
    await process(new ScrapingWorker());
    await process(new ScrapingWorker());
    for (const [query] of mocks.save.mock.calls) {
      expect(query).toMatchObject({ where: { id: "scraping_job-test" }, update: {}, create: { id: "scraping_job-test" } });
    }
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });
  it("não grava quando perdeu o lease", async () => {
    mocks.renew.mockResolvedValue(false);
    await process(new ScrapingWorker());
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
