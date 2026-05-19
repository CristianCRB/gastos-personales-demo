import { Redis } from 'ioredis';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';

let redisAvailable = false;
let everSucceeded = false;

export async function checkRedisConnection(): Promise<boolean> {
  if (everSucceeded && redisAvailable) return true;

  const redis = new Redis(env.REDIS_URL, { connectTimeout: 3000, lazyConnect: true });
  redis.on('error', () => {});

  try {
    await redis.connect();
    await redis.ping();

    // BullMQ requires Redis >= 5.0.0
    const info = await redis.info('server');
    const redisVersion = info.match(/redis_version:(\d+\.\d+)/)?.[1];
    if (redisVersion) {
      const version = parseFloat(redisVersion);
      if (version < 5) {
        logger.warn(`Redis version ${redisVersion} is too old — BullMQ requires >= 5.0.0`);
        redisAvailable = false;
        return false;
      }
    }

    redisAvailable = true;
    everSucceeded = true;
    logger.info('Redis connection established');
    return true;
  } catch {
    redisAvailable = false;
    return false;
  } finally {
    redis.disconnect();
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}
