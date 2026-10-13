import { scrapingQueue, ScrapingJob, ScrapingResult } from "./scraping-queue";
import { wikipediaScraper } from "./scrapers/wikipedia";

export class ScrapingWorker {
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

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
    try {
      const job = await scrapingQueue.dequeue();
      if (!job) {
        return;
      }

      console.log(`Processing job ${job.id}: ${job.url} (${job.source})`);

      const result = await this.executeJob(job);
      await scrapingQueue.completeJob(job.id, result);

      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      console.error("Error processing job:", error);
    }
  }

  private async executeJob(job: ScrapingJob): Promise<ScrapingResult> {
    try {
      let data: unknown;

      switch (job.source) {
        case "wikipedia":
          data = await this.scrapeWikipedia(job);
          break;
        default:
          throw new Error(`Unknown source: ${job.source}`);
      }

      return {
        jobId: job.id,
        success: true,
        data,
        completedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Job ${job.id} failed:`, errorMessage);
      
      await scrapingQueue.failJob(job.id, errorMessage);

      return {
        jobId: job.id,
        success: false,
        error: errorMessage,
        completedAt: Date.now(),
      };
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
