import { createClient } from 'redis';
import { env } from './config';

export const redis = createClient({ url: env.REDIS_URL });
export const redisSub = createClient({ url: env.REDIS_URL });

export async function initRedis() {
  redis.on('error', (err) => console.error('[redis]', err));
  redisSub.on('error', (err) => console.error('[redisSub]', err));
  await redis.connect();
  await redisSub.connect();
}
