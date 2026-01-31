import { createClient } from 'redis';
import { Pool } from 'pg';
import { env } from './config';
import type { PlayersSnapshot, GuildsSnapshot } from '@joyforge/shared';

const redis = createClient({ url: env.REDIS_URL });
const pgPool = new Pool({ connectionString: env.POSTGRES_URL });

const TOP_N = env.TOP_N;

const LB_PLAYERS = 'lb:players';
const LB_GUILDS = 'lb:guilds';

const DIRTY_USERS = 'dirty:users';
const DIRTY_GUILDS = 'dirty:guilds';

function nowTs() {
  return Date.now();
}

async function hydrateUsernames(userIds: string[]): Promise<Record<string, string>> {
  if (!userIds.length) return {};
  const keys = userIds.map((id) => `user:${id}:username`);
  const vals = await redis.mGet(keys);
  const map: Record<string, string> = {};
  userIds.forEach((id, i) => {
    map[id] = vals[i] ?? 'Unknown';
  });
  return map;
}

async function hydrateGuildNames(guildIds: string[]): Promise<Record<string, string>> {
  if (!guildIds.length) return {};
  const keys = guildIds.map((id) => `guild:${id}:name`);
  const vals = await redis.mGet(keys);
  const map: Record<string, string> = {};
  guildIds.forEach((id, i) => {
    map[id] = vals[i] ?? 'Unknown';
  });
  return map;
}

async function publishSnapshots() {
  const players = await redis.zRangeWithScores(LB_PLAYERS, 0, TOP_N - 1, { REV: true });
  const playerIds = players.map((p) => p.value);
  const usernames = await hydrateUsernames(playerIds);

  const playersPayload: PlayersSnapshot = {
    channel: 'lb:players',
    ts: nowTs(),
    items: players.map((p, i) => ({
      rank: i + 1,
      userId: p.value,
      username: usernames[p.value] ?? 'Unknown',
      totalUsd: Math.trunc(p.score)
    }))
  };

  const guilds = await redis.zRangeWithScores(LB_GUILDS, 0, TOP_N - 1, { REV: true });
  const guildIds = guilds.map((g) => g.value);
  const guildNames = await hydrateGuildNames(guildIds);

  const guildsPayload: GuildsSnapshot = {
    channel: 'lb:guilds',
    ts: nowTs(),
    items: guilds.map((g, i) => ({
      rank: i + 1,
      guildId: g.value,
      guildName: guildNames[g.value] ?? 'Unknown',
      goalScore: Math.trunc(g.score)
    }))
  };

  await redis.publish('pub:lb:snapshot', JSON.stringify(playersPayload));
  await redis.publish('pub:lb:snapshot', JSON.stringify(guildsPayload));
}

async function flushDirty() {
  // Pop up to 500 ids at a time
  const userIds = (await redis.sPop(DIRTY_USERS, 500)) as unknown as string[] | null;
  const guildIds = (await redis.sPop(DIRTY_GUILDS, 500)) as unknown as string[] | null;

  const uIds = (userIds ?? []).filter(Boolean);
  const gIds = (guildIds ?? []).filter(Boolean);

  if (!uIds.length && !gIds.length) return;

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    if (uIds.length) {
      const usdKeys = uIds.map((id) => `user:${id}:usd`);
      const clicksKeys = uIds.map((id) => `user:${id}:clicks`);
      const usdVals = await redis.mGet(usdKeys);
      const clickVals = await redis.mGet(clicksKeys);

      for (let i = 0; i < uIds.length; i++) {
        const userId = uIds[i];
        const totalUsd = Number(usdVals[i] ?? 0);
        const totalClicks = Number(clickVals[i] ?? 0);
        await client.query(
          `INSERT INTO user_stats (user_id, total_usd, total_clicks)
           VALUES ($1,$2,$3)
           ON CONFLICT (user_id) DO UPDATE SET total_usd=$2, total_clicks=$3`,
          [userId, totalUsd, totalClicks]
        );
      }
    }

    if (gIds.length) {
      const vaultKeys = gIds.map((id) => `guild:${id}:vault`);
      const scoreKeys = gIds.map((id) => `guild:${id}:goal:score`);
      const targetKeys = gIds.map((id) => `guild:${id}:goal:target`);
      const progressKeys = gIds.map((id) => `guild:${id}:goal:progress`);

      const [vaultVals, scoreVals, targetVals, progressVals] = await Promise.all([
        redis.mGet(vaultKeys),
        redis.mGet(scoreKeys),
        redis.mGet(targetKeys),
        redis.mGet(progressKeys)
      ]);

      for (let i = 0; i < gIds.length; i++) {
        const guildId = gIds[i];
        const vaultTotal = Number(vaultVals[i] ?? 0);
        const goalScore = Number(scoreVals[i] ?? 0);
        const target = Number(targetVals[i] ?? 100);
        const progress = Number(progressVals[i] ?? 0);

        await client.query(
          `INSERT INTO guild_stats (guild_id, vault_total, goal_score)
           VALUES ($1,$2,$3)
           ON CONFLICT (guild_id) DO UPDATE SET vault_total=$2, goal_score=$3`,
          [guildId, vaultTotal, goalScore]
        );

        await client.query(
          `INSERT INTO guild_goal_state (guild_id, target, progress)
           VALUES ($1,$2,$3)
           ON CONFLICT (guild_id) DO UPDATE SET target=$2, progress=$3, updated_at=NOW()`,
          [guildId, target, progress]
        );
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[worker flush]', e);
  } finally {
    client.release();
  }
}

async function main() {
  redis.on('error', (e) => console.error('[worker redis]', e));
  await redis.connect();

  console.log('[worker] started');

  setInterval(() => {
    publishSnapshots().catch((e) => console.error('[snapshot]', e));
  }, env.SNAPSHOT_INTERVAL_MS);

  setInterval(() => {
    flushDirty().catch((e) => console.error('[flush]', e));
  }, env.FLUSH_INTERVAL_MS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
