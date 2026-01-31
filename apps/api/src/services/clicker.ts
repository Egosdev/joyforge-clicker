import { redis } from '../redis';
import { redisKeys } from './state';

const LB_PLAYERS = 'lb:players';
const LB_GUILDS = 'lb:guilds';
const DIRTY_USERS = 'dirty:users';
const DIRTY_GUILDS = 'dirty:guilds';

export type ClickResult = {
  userUsd: number;
  userClicks: number;
  guildVault?: number;
  guildScore?: number;
  guildProgress?: number;
  guildTarget?: number;
  completed?: boolean;
};

const scriptNoGuild = `
local userUsdKey = KEYS[1]
local userClicksKey = KEYS[2]
local lbPlayersKey = KEYS[3]
local dirtyUsersKey = KEYS[4]

local userId = ARGV[1]
local gain = tonumber(ARGV[2])

redis.call('INCRBY', userUsdKey, gain)
redis.call('INCR', userClicksKey)
redis.call('ZINCRBY', lbPlayersKey, gain, userId)
redis.call('SADD', dirtyUsersKey, userId)

local usd = redis.call('GET', userUsdKey)
local clicks = redis.call('GET', userClicksKey)
return {usd, clicks}
`;

const scriptWithGuild = `
math.randomseed(tonumber(redis.call('TIME')[2]))

local userUsdKey = KEYS[1]
local userClicksKey = KEYS[2]
local lbPlayersKey = KEYS[3]
local dirtyUsersKey = KEYS[4]

local guildVaultKey = KEYS[5]
local guildTargetKey = KEYS[6]
local guildProgressKey = KEYS[7]
local guildScoreKey = KEYS[8]
local lbGuildsKey = KEYS[9]
local dirtyGuildsKey = KEYS[10]

local userId = ARGV[1]
local guildId = ARGV[2]
local playerGain = tonumber(ARGV[3])
local guildGain = tonumber(ARGV[4])

redis.call('INCRBY', userUsdKey, playerGain)
redis.call('INCR', userClicksKey)
redis.call('ZINCRBY', lbPlayersKey, playerGain, userId)
redis.call('SADD', dirtyUsersKey, userId)

redis.call('INCRBY', guildVaultKey, guildGain)
redis.call('SADD', dirtyGuildsKey, guildId)

local target = tonumber(redis.call('GET', guildTargetKey))
if not target then
  target = math.random(100,300)
  redis.call('SET', guildTargetKey, target)
end

local progress = tonumber(redis.call('GET', guildProgressKey)) or 0
if progress < target then
  progress = progress + 1
  if progress > target then progress = target end
  redis.call('SET', guildProgressKey, progress)
end

local score = tonumber(redis.call('GET', guildScoreKey)) or 0
local completed = 0

if progress >= target then
  completed = 1
  score = score + 1
  redis.call('SET', guildScoreKey, score)
  redis.call('ZINCRBY', lbGuildsKey, 1, guildId)
  redis.call('SET', guildProgressKey, 0)
  target = math.random(100,300)
  redis.call('SET', guildTargetKey, target)
  progress = 0
end

local usd = redis.call('GET', userUsdKey)
local clicks = redis.call('GET', userClicksKey)
local vault = redis.call('GET', guildVaultKey)
local scoreNow = redis.call('GET', guildScoreKey)
local progressNow = redis.call('GET', guildProgressKey)
local targetNow = redis.call('GET', guildTargetKey)

return {usd, clicks, vault, scoreNow, progressNow, targetNow, tostring(completed)}
`;

let shaNoGuild: string | null = null;
let shaWithGuild: string | null = null;

export async function loadClickScripts() {
  shaNoGuild = await redis.scriptLoad(scriptNoGuild);
  shaWithGuild = await redis.scriptLoad(scriptWithGuild);
}

export async function applyClick(
  userId: string,
  playerGain: number,
  guildGain: number,
  guildId: string | null
): Promise<ClickResult> {
  if (!shaNoGuild || !shaWithGuild) throw new Error('Click scripts not loaded');

  const userUsdKey = redisKeys.USER_USD(userId);
  const userClicksKey = redisKeys.USER_CLICKS(userId);

  if (!guildId) {
    const r = (await redis.evalSha(shaNoGuild, {
      keys: [userUsdKey, userClicksKey, LB_PLAYERS, DIRTY_USERS],
      arguments: [userId, String(playerGain)]
    })) as string[];

    return { userUsd: Number(r[0]), userClicks: Number(r[1]) };
  }

  const r = (await redis.evalSha(shaWithGuild, {
    keys: [
      userUsdKey,
      userClicksKey,
      LB_PLAYERS,
      DIRTY_USERS,
      redisKeys.GUILD_VAULT(guildId),
      redisKeys.GUILD_GOAL_TARGET(guildId),
      redisKeys.GUILD_GOAL_PROGRESS(guildId),
      redisKeys.GUILD_GOAL_SCORE(guildId),
      LB_GUILDS,
      DIRTY_GUILDS
    ],
    arguments: [userId, guildId, String(playerGain), String(guildGain)]
  })) as string[];

  return {
    userUsd: Number(r[0]),
    userClicks: Number(r[1]),
    guildVault: Number(r[2]),
    guildScore: Number(r[3]),
    guildProgress: Number(r[4]),
    guildTarget: Number(r[5]),
    completed: r[6] === '1'
  };
}
