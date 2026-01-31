export type LeaderboardChannel = 'lb:players' | 'lb:guilds';

export type PlayersLeaderboardItem = {
  rank: number;
  userId: string;
  username: string;
  totalUsd: number;
};

export type GuildsLeaderboardItem = {
  rank: number;
  guildId: string;
  guildName: string;
  goalScore: number;
};

export type PlayersSnapshot = {
  channel: 'lb:players';
  ts: number;
  items: PlayersLeaderboardItem[];
};

export type GuildsSnapshot = {
  channel: 'lb:guilds';
  ts: number;
  items: GuildsLeaderboardItem[];
};

export type LeaderboardSnapshotPayload = PlayersSnapshot | GuildsSnapshot;

export type SubscribePayload = {
  channel: LeaderboardChannel;
};

export type ClickResponse = {
  gain: number;
  user: { totalUsd: number; totalClicks: number };
  guild?: {
    guildId: string;
    vaultTotal: number;
    goal: { progress: number; target: number; score: number };
  };
};
