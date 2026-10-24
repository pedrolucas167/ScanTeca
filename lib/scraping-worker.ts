import { scrapingQueue, ScrapingJob, ScrapingResult, ClaimedScrapingJob } from "./scraping-queue";
import { wikipediaScraper } from "./scrapers/wikipedia";
import { prisma } from "./prisma";
import { generateEmbedding, externalDataToEmbeddingText } from "./embeddings";

export class ScrapingWorker {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;
  private busy = false;

  async start(pollIntervalMs = 5000) {
    if (this.isRunning) {
      console.log("Scraping worker already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting scraping worker...");

    this.interval = setInterval(async () => {
      await this.processNextJob();
    }, pollIntervalMs);

    // Process one job immediately
    await this.processNextJob();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log("Scraping worker stopped");
  }

  private async processNextJob() {
    if (this.busy) return;
    this.busy = true;
    let heartbeat: NodeJS.Timeout | undefined;
    try {
      const job = await scrapingQueue.dequeue();
      if (!job) {
        return;
      }
      heartbeat = setInterval(() => {
        void scrapingQueue.renewJob(job.id, job.claimToken).catch(error => {
          console.error(`Falha ao renovar lease de ${job.id}:`, error);
        });
      }, scrapingQueue.leaseMs / 3);

      console.log(`Processing job ${job.id}: ${job.url} (${job.source})`);

      const result = await this.executeJob(job);
      if (result.success) {
        await scrapingQueue.completeJob(job.id, result, job.claimToken);
      } else {
        await scrapingQueue.failJob(job.id, result.error ?? "Falha no scraping", job.claimToken);
      }

      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      console.error("Error processing job:", error);
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      this.busy = false;
    }
  }

  private async executeJob(job: ClaimedScrapingJob): Promise<ScrapingResult> {
    try {
      let data: unknown;

      switch (job.source) {
        case "wikipedia":
          data = await this.scrapeWikipedia(job);
          break;
        default:
          throw new Error(`Unknown source: ${job.source}`);
      }

      // Save to database with embedding
      await this.saveToDatabase(job, data);

      return {
        jobId: job.id,
        success: true,
        data,
        completedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Job ${job.id} failed:`, errorMessage);

      return {
        jobId: job.id,
        success: false,
        error: errorMessage,
        completedAt: Date.now(),
      };
    }
  }

  private async saveToDatabase(job: ClaimedScrapingJob, data: unknown) {
    if (!job.userId) {
      console.warn(`Job ${job.id} has no userId, skipping database save`);
      return;
    }

    try {
      let title = "";
      let content = "";
      const type = job.type || "article";

      if (job.source === "wikipedia") {
        const article = data as { title?: string; content?: string; url?: string };
        title = article.title || job.url;
        content = article.content || "";
      }

      if (!title || !content) {
        console.warn(`Job ${job.id} has no title or content, skipping database save`);
        return;
      }

      // Generate embedding
      const embeddingText = externalDataToEmbeddingText({
        source: job.source,
        title,
        content: content.slice(0, 8000),
        type,
      });
      const embedding = await generateEmbedding(embeddingText);
      if (!await scrapingQueue.renewJob(job.id, job.claimToken)) {
        throw new Error("Lease perdido antes da gravação");
      }
      // A recuperação é at-least-once: o mesmo job sempre grava o mesmo ID.
      const id = `scraping_${job.id}`;

      // Save to database with embedding using raw query
      if (embedding) {
        await prisma.$queryRaw`
          INSERT INTO "ExternalResearchData" ("id", "userId", "source", "url", "title", "content", "type", "embedding", "scrapedAt", "createdAt", "updatedAt")
          VALUES (${id}, ${job.userId}, ${job.source}, ${job.url}, ${title}, ${content}, ${type}, ${`[${embedding.join(",")}]`}::vector, NOW(), NOW(), NOW())
          ON CONFLICT ("id") DO NOTHING
        `;
      } else {
        await prisma.externalResearchData.upsert({
          where: { id },
          update: {},
          create: {
            id,
            userId: job.userId,
            source: job.source,
            url: job.url,
            title,
            content,
            type,
          },
        });
      }

      console.log(`Job ${job.id} saved to database`);
    } catch (error) {
      console.error(`Error saving job ${job.id} to database:`, error);
      throw error;
    }
  }

  private async scrapeWikipedia(job: ScrapingJob) {
    const url = new URL(job.url);
    const pathParts = url.pathname.split("/");
    const title = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || "";

    if (job.type === "article" || job.type === "metadata") {
      return await wikipediaScraper.scrapeArticle(title);
    } else if (job.type === "book" && job.metadata?.query) {
      return await wikipediaScraper.searchArticles(job.metadata.query as string, 5);
    } else {
      return await wikipediaScraper.scrapeArticle(title);
    }
  }
}

// Singleton instance
export const scrapingWorker = new ScrapingWorker();
