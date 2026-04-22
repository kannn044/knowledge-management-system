import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  reconnectOnError: (err) => {
    logger.warn(`Redis reconnecting on error: ${err.message}`);
    return true;
  },
});

// BullMQ requires maxRetriesPerRequest: null for blocking commands
export const bullmqRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  reconnectOnError: (err) => {
    logger.warn(`BullMQ Redis reconnecting on error: ${err.message}`);
    return true;
  },
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('❌ Redis error', err));
redis.on('close', () => logger.warn('Redis connection closed'));

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    logger.error('❌ Redis connection failed', error);
    process.exit(1);
  }
}
