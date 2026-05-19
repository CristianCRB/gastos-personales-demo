import { logger } from '@/shared/utils/logger.js';

interface QueueJob {
  execute: () => Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
  label: string;
}

export class MemoryQueue {
  private jobs: QueueJob[] = [];
  private processing = false;

  enqueue(label: string, fn: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.jobs.push({ execute: fn, resolve, reject, label });
      if (!this.processing) this.next();
    });
  }

  private async next(): Promise<void> {
    if (this.jobs.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const job = this.jobs.shift()!;

    try {
      await job.execute();
      job.resolve();
    } catch (err) {
      job.reject(err instanceof Error ? err : new Error(String(err)));
    }

    logger.debug(`MemoryQueue: ${this.jobs.length} jobs remaining`);
    this.next();
  }

  get length(): number {
    return this.jobs.length;
  }
}
