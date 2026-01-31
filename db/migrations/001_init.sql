-- Initial schema for Joyforge Clicker

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uniq ON users (username_lower);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_usd BIGINT NOT NULL DEFAULT 0,
  total_clicks BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  capacity INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS guilds_name_lower_uniq ON guilds (name_lower);

-- A user can belong to only one guild: enforce unique(user_id)
CREATE TABLE IF NOT EXISTS guild_members (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER','MEMBER')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guild_members_guild_id_idx ON guild_members (guild_id);

CREATE TABLE IF NOT EXISTS guild_stats (
  guild_id UUID PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  vault_total BIGINT NOT NULL DEFAULT 0,
  goal_score BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guild_goal_state (
  guild_id UUID PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  target INT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guild_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS guild_invites_invited_user_idx ON guild_invites (invited_user_id);
CREATE INDEX IF NOT EXISTS guild_invites_guild_idx ON guild_invites (guild_id);
