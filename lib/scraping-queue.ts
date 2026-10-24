import type { Redis } from "@upstash/redis";
import { getRedis } from "./redis";
import { randomUUID } from "node:crypto";
import { CLAIM_JOB, COMPLETE_JOB, FAIL_JOB, RENEW_JOB } from "./scraping-queue-scripts";

export interface ScrapingJob {
  id: string;
  url: string;
  source: string;
  type: "book" | "article" | "review" | "metadata";
  priority: number;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface ScrapingResult {
  jobId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  completedAt: number;
}

export interface ClaimedScrapingJob extends ScrapingJob {
  claimToken: string;
  leaseUntil: number;
}

const QUEUE_KEY = "scraping:queue";
const PROCESSING_KEY = "scraping:processing";
const RESULTS_KEY = "scraping:results";

const QUEUE_KEYS = [QUEUE_KEY, PROCESSING_KEY, RESULTS_KEY, "scraping:leases", "scraping:delayed", "scraping:scan-cursor"];

export class ScrapingQueue {
  private redis: Redis | null = null;

  constructor(redis: Redis | null = getRedis(), readonly leaseMs = 120_000) {
    this.redis = redis;
  }

  async enqueue(job: Omit<ScrapingJob, "id" | "createdAt" | "attempts">): Promise<string> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    if (!Number.isFinite(job.priority) || !Number.isInteger(job.maxAttempts) || job.maxAttempts < 1) {
      throw new Error("Invalid scraping job priority or maxAttempts");
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

  async dequeue(): Promise<ClaimedScrapingJob | null> {
    const value = await this.client().eval<[string, number], ClaimedScrapingJob | string | null>(
      CLAIM_JOB, QUEUE_KEYS, [randomUUID(), this.leaseMs]
    );
    return typeof value === "string" ? JSON.parse(value) : value;
  }

  async completeJob(jobId: string, result: ScrapingResult, claimToken: string): Promise<boolean> {
    return (await this.client().eval(COMPLETE_JOB, QUEUE_KEYS, [jobId, claimToken, JSON.stringify(result)])) === 1;
  }

  async failJob(jobId: string, error: string, claimToken: string): Promise<boolean> {
    return (await this.client().eval(FAIL_JOB, QUEUE_KEYS, [jobId, claimToken, error])) === 1;
  }

  async renewJob(jobId: string, claimToken: string): Promise<boolean> {
    return (await this.client().eval(RENEW_JOB, QUEUE_KEYS, [jobId, claimToken, this.leaseMs])) === 1;
  }

  private client(): Redis {
    if (!this.redis) throw new Error("Redis not available for scraping queue");
    return this.redis;
  }
  async getResult(jobId: string): Promise<ScrapingResult | null> {
    if (!this.redis) {
      throw new Error("Redis not available for scraping queue");
    }

    const resultData = await this.redis.hget(RESULTS_KEY, jobId);
    if (!resultData) return null;

    return typeof resultData === "string" ? JSON.parse(resultData) as ScrapingResult : resultData as ScrapingResult;
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
