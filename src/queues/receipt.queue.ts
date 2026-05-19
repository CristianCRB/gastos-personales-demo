import { Queue, type QueueOptions } from 'bullmq';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';
import { checkRedisConnection } from '@/queues/connection.js';
import { getOrCreateWorker } from '@/workers/receipt.worker.js';

export interface ReceiptJobData {
  serializedMessage: string;
  phoneNumber: string;
  from: string;
  mimeType: string;
  msgKey: {
    remoteJid: string;
    id: string;
    fromMe: boolean;
    participant?: string | null;
  };
}

let queue: Queue<ReceiptJobData> | null = null;

async function getQueue(): Promise<Queue<ReceiptJobData> | null> {
  if (queue) return queue;

  const available = await checkRedisConnection();
  if (!available) {
    logger.error('Cannot queue receipt — Redis is not available');
    return null;
  }

  const options: QueueOptions = {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
      attempts: 10,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 86400, count: 500 },
    },
  };

  queue = new Queue<ReceiptJobData>('receipt-processing', options);

  getOrCreateWorker().then((w) => {
    if (w) logger.info('Receipt worker started (lazy)');
  });

  return queue;
}

export async function addReceiptJob(data: ReceiptJobData): Promise<string | null> {
  const q = await getQueue();
  if (!q) return null;

  const jobId = `${data.msgKey.remoteJid}_${data.msgKey.id}`;

  const exists = await q.getJob(jobId);
  if (exists) {
    const state = await exists.getState();
    logger.info(`Duplicate receipt job skipped — ${jobId} (state: ${state})`);
    return null;
  }

  const job = await q.add('process-receipt', data, { jobId });
  logger.info(`Receipt job queued — ${jobId}`);
  return jobId;
}

export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
