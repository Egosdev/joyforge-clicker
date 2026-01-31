import { redis } from '../redis';

/**
 * Simple per-user fixed window limiter: max N actions per epochSecond.
 * O(1) per call.
 */
export async function enforcePerSecondLimit(opts: {
  prefix: string;
  userId: string;
  maxPerSecond: number;
}): Promise<{ ok: true } | { ok: false; remaining: number }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const key = `${opts.prefix}:${opts.userId}:${nowSec}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // expire shortly after window ends
    await redis.expire(key, 2);
  }
  if (count > opts.maxPerSecond) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true };
}
