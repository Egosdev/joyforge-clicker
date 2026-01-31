import { redis } from '../redis';
import { pgPool } from '../db';

export type UserTotals = { totalUsd: number; totalClicks: number };
export type GuildState = {
  guildId: string;
  vaultTotal: number;
  goal: { progress: number; target: number; score: number };
};

const USER_USD = (u: string) => `user:${u}:usd`;
const USER_CLICKS = (u: string) => `user:${u}:clicks`;
const USER_GUILD = (u: string) => `user:${u}:guild`;

const GUILD_VAULT = (g: string) => `guild:${g}:vault`;
const GUILD_GOAL_TARGET = (g: string) => `guild:${g}:goal:target`;
const GUILD_GOAL_PROGRESS = (g: string) => `guild:${g}:goal:progress`;
const GUILD_GOAL_SCORE = (g: string) => `guild:${g}:goal:score`;

async function seedUserFromDb(userId: string): Promise<UserTotals> {
  const r = await pgPool.query(`SELECT total_usd, total_clicks FROM user_stats WHERE user_id=$1`, [userId]);
  const row = r.rows[0] as { total_usd: string; total_clicks: string } | undefined;
  const totalUsd = Number(row?.total_usd ?? 0);
  const totalClicks = Number(row?.total_clicks ?? 0);
  await redis.mSet({
    [USER_USD(userId)]: String(totalUsd),
    [USER_CLICKS(userId)]: String(totalClicks)
  });
  return { totalUsd, totalClicks };
}

export async function getUserTotals(userId: string): Promise<UserTotals> {
  const [usd, clicks] = await redis.mGet([USER_USD(userId), USER_CLICKS(userId)]);
  if (usd !== null && clicks !== null) {
    return { totalUsd: Number(usd), totalClicks: Number(clicks) };
  }
  return seedUserFromDb(userId);
}

export async function getUserGuildId(userId: string): Promise<string | null> {
  const cached = await redis.get(USER_GUILD(userId));
  if (cached !== null) return cached === '' ? null : cached;

  const r = await pgPool.query(`SELECT guild_id FROM guild_members WHERE user_id=$1`, [userId]);
  const guildId = (r.rows[0] as { guild_id: string } | undefined)?.guild_id ?? null;

  // Cache short: guild membership changes are rare, but this avoids DB reads on spam clicks
  await redis.set(USER_GUILD(userId), guildId ?? '', { EX: 60 });
  return guildId;
}

async function seedGuildFromDb(guildId: string): Promise<GuildState> {
  const stats = await pgPool.query(`SELECT vault_total, goal_score FROM guild_stats WHERE guild_id=$1`, [guildId]);
  const goal = await pgPool.query(`SELECT target, progress FROM guild_goal_state WHERE guild_id=$1`, [guildId]);

  const vaultTotal = Number((stats.rows[0] as any)?.vault_total ?? 0);
  const score = Number((stats.rows[0] as any)?.goal_score ?? 0);
  const target = Number((goal.rows[0] as any)?.target ?? 100);
  const progress = Number((goal.rows[0] as any)?.progress ?? 0);

  await redis.mSet({
    [GUILD_VAULT(guildId)]: String(vaultTotal),
    [GUILD_GOAL_SCORE(guildId)]: String(score),
    [GUILD_GOAL_TARGET(guildId)]: String(target),
    [GUILD_GOAL_PROGRESS(guildId)]: String(progress)
  });

  return { guildId, vaultTotal, goal: { progress, target, score } };
}

export async function getGuildState(guildId: string): Promise<GuildState> {
  const [vault, score, target, progress] = await redis.mGet([
    GUILD_VAULT(guildId),
    GUILD_GOAL_SCORE(guildId),
    GUILD_GOAL_TARGET(guildId),
    GUILD_GOAL_PROGRESS(guildId)
  ]);

  if (vault !== null && score !== null && target !== null && progress !== null) {
    return {
      guildId,
      vaultTotal: Number(vault),
      goal: { progress: Number(progress), target: Number(target), score: Number(score) }
    };
  }

  return seedGuildFromDb(guildId);
}

export const redisKeys = {
  USER_USD,
  USER_CLICKS,
  USER_GUILD,
  GUILD_VAULT,
  GUILD_GOAL_TARGET,
  GUILD_GOAL_PROGRESS,
  GUILD_GOAL_SCORE
};
