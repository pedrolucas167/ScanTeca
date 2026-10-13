import { Redis } from "@upstash/redis";
import { getRedis } from "./redis";

export interface ScrapingJob {
  id: string;
  url: string;
  source: string;
  type: "book" | "article" | "review" | "metadata";
  priority: number;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  metadata?: Record<string, unknown>;
}

export interface ScrapingResult {
  jobId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  completedAt: number;
}

const QUEUE_KEY = "scraping:queue";
const PROCESSING_KEY = "scraping:processing";
const RESULTS_KEY = "scraping:results";

class ScrapingQueue {
  private redis: Redis | null = null;

  constructor() {
    this.redis = getRedis();
  }

  async enqueue(job: Omit<ScrapingJob, "id" | "createdAt" | "attempts">): Promise<string> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    const jobWithId: ScrapingJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      attempts: 0,
    };

    // Add to sorted set by priority (higher priority = lower score)
    await this.redis.zadd(QUEUE_KEY, {
      score: -job.priority,
      member: JSON.stringify(jobWithId),
    });

    return jobWithId.id;
  }

  async dequeue(): Promise<ScrapingJob | null> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    // Get highest priority job (lowest score)
    const result = await this.redis.zrange(QUEUE_KEY, 0, 0, { withScores: true });

    if (!result || result.length === 0) {
      return null;
    }

    const jobData = result[0] as string;
    const job: ScrapingJob = JSON.parse(jobData);

    // Remove from queue
    await this.redis.zrem(QUEUE_KEY, jobData);

    // Move to processing set
    await this.redis.hset(PROCESSING_KEY, { [job.id]: JSON.stringify(job) });

    return job;
  }

  async completeJob(jobId: string, result: ScrapingResult): Promise<void> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    // Remove from processing
    await this.redis.hdel(PROCESSING_KEY, jobId);

    // Store result with TTL (24 hours)
    await this.redis.hset(RESULTS_KEY, { [jobId]: JSON.stringify(result) });
    await this.redis.expire(RESULTS_KEY, 86400);
  }

  async failJob(jobId: string, error: string): Promise<void> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    const jobData = await this.redis.hget(PROCESSING_KEY, jobId);
    if (!jobData) return;

    const job: ScrapingJob = JSON.parse(jobData as string);
    job.attempts++;

    // Remove from processing
    await this.redis.hdel(PROCESSING_KEY, jobId);

    // Requeue if max attempts not reached
    if (job.attempts < job.maxAttempts) {
      // Exponential backoff: delay increases with attempts
      const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 60000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      
      await this.redis.zadd(QUEUE_KEY, {
        score: -job.priority,
        member: JSON.stringify(job),
      });
    } else {
      // Store failed result
      await this.redis.hset(RESULTS_KEY, {
        [jobId]: JSON.stringify({
          jobId,
          success: false,
          error,
          completedAt: Date.now(),
        } as ScrapingResult),
      });
      await this.redis.expire(RESULTS_KEY, 86400);
    }
  }

  async getResult(jobId: string): Promise<ScrapingResult | null> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    const resultData = await this.redis.hget(RESULTS_KEY, jobId);
    if (!resultData) return null;

    return JSON.parse(resultData as string) as ScrapingResult;
  }

  async getQueueSize(): Promise<number> {
    if (!this.redis) return 0;
    return await this.redis.zcard(QUEUE_KEY);
  }

  async getProcessingCount(): Promise<number> {
    if (!this.redis) return 0;
    return await this.redis.hlen(PROCESSING_KEY);
  }
}

export const scrapingQueue = new ScrapingQueue();
