import { Router } from 'express';
import { redis } from '../redis';
import { pgPool } from '../db';

const router = Router();

async function hydrateUsernames(userIds: string[]): Promise<Record<string, string>> {
  const keys = userIds.map((id) => `user:${id}:username`);
  const cached = await redis.mGet(keys);
  const map: Record<string, string> = {};
  const missing: string[] = [];
  userIds.forEach((id, i) => {
    const val = cached[i];
    if (val) map[id] = val;
    else missing.push(id);
  });
  if (missing.length) {
    const r = await pgPool.query(`SELECT id, username FROM users WHERE id = ANY($1::uuid[])`, [missing]);
    for (const row of r.rows as any[]) {
      map[row.id] = row.username;
      await redis.set(`user:${row.id}:username`, row.username);
    }
  }
  return map;
}

async function hydrateGuildNames(guildIds: string[]): Promise<Record<string, string>> {
  const keys = guildIds.map((id) => `guild:${id}:name`);
  const cached = await redis.mGet(keys);
  const map: Record<string, string> = {};
  const missing: string[] = [];
  guildIds.forEach((id, i) => {
    const val = cached[i];
    if (val) map[id] = val;
    else missing.push(id);
  });
  if (missing.length) {
    const r = await pgPool.query(`SELECT id, name FROM guilds WHERE id = ANY($1::uuid[])`, [missing]);
    for (const row of r.rows as any[]) {
      map[row.id] = row.name;
      await redis.set(`guild:${row.id}:name`, row.name);
    }
  }
  return map;
}

router.get('/leaderboard/players', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 100);
  const raw = await redis.zRangeWithScores('lb:players', 0, limit - 1, { REV: true });
  const userIds = raw.map((r) => r.value);
  const names = await hydrateUsernames(userIds);

  const items = raw.map((r, idx) => ({
    rank: idx + 1,
    userId: r.value,
    username: names[r.value] ?? 'Unknown',
    totalUsd: Math.trunc(r.score)
  }));

  return res.json({ items });
});

router.get('/leaderboard/guilds', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 100);
  const raw = await redis.zRangeWithScores('lb:guilds', 0, limit - 1, { REV: true });
  const guildIds = raw.map((r) => r.value);
  const names = await hydrateGuildNames(guildIds);

  const items = raw.map((r, idx) => ({
    rank: idx + 1,
    guildId: r.value,
    guildName: names[r.value] ?? 'Unknown',
    goalScore: Math.trunc(r.score)
  }));

  return res.json({ items });
});

export default router;
