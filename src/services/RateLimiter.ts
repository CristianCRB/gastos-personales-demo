import { logger } from '@/shared/utils/logger.js';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 50, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0]!;
      const waitMs = this.windowMs - (now - oldest) + 100;
      logger.warn(`Rate limit reached — waiting ${waitMs}ms`);
      await delay(waitMs);
    }

    this.timestamps.push(Date.now());
  }
}

export class ConcurrencyLimiter {
  private active = 0;
  private readonly max: number;

  constructor(max = 1) {
    this.max = max;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.active >= this.max) {
      await delay(100);
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
    }
  }
}
