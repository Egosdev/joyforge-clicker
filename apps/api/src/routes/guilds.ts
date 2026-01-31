import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares';
import { pgPool } from '../db';
import { normalizeCaseInsensitiveName } from '../utils';
import { redis } from '../redis';
import { getUserGuildId } from '../services/state';

const router = Router();

const CreateGuildSchema = z.object({
  name: z.string().min(3).max(30)
});

router.post('/guilds', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const existing = await getUserGuildId(userId);
  if (existing) return res.status(409).json({ error: 'ALREADY_IN_GUILD' });

  const parsed = CreateGuildSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });

  const { display, lower } = normalizeCaseInsensitiveName(parsed.data.name);

  const target = 100 + Math.floor(Math.random() * 201); // 100..300

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const g = await client.query(
      `INSERT INTO guilds (name, name_lower, owner_user_id, capacity)
       VALUES ($1,$2,$3,5)
       RETURNING id, name`,
      [display, lower, userId]
    );
    const guild = g.rows[0] as { id: string; name: string };

    await client.query(
      `INSERT INTO guild_members (user_id, guild_id, role)
       VALUES ($1,$2,'OWNER')`,
      [userId, guild.id]
    );

    await client.query(`INSERT INTO guild_stats (guild_id) VALUES ($1)`, [guild.id]);
    await client.query(`INSERT INTO guild_goal_state (guild_id, target, progress) VALUES ($1,$2,0)`, [guild.id, target]);

    await client.query('COMMIT');

    // Redis caches
    await redis.mSet({
      [`user:${userId}:guild`]: guild.id,
      [`guild:${guild.id}:name`]: guild.name,
      [`guild:${guild.id}:vault`]: '0',
      [`guild:${guild.id}:goal:score`]: '0',
      [`guild:${guild.id}:goal:progress`]: '0',
      [`guild:${guild.id}:goal:target`]: String(target)
    });
    // Ensure leaderboard entry exists
    await redis.zAdd('lb:guilds', [{ score: 0, value: guild.id }]);

    return res.json({ guild: { id: guild.id, name: guild.name, capacity: 5, target } });
  } catch (e: any) {
    await client.query('ROLLBACK');
    if (String(e?.message || '').includes('guilds_name_lower_uniq')) {
      return res.status(409).json({ error: 'GUILD_NAME_TAKEN' });
    }
    console.error('[create guild]', e);
    return res.status(500).json({ error: 'INTERNAL' });
  } finally {
    client.release();
  }
});

// Get my guild details
router.get('/guilds/me', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const r = await pgPool.query(
    `SELECT g.id, g.name, g.capacity, g.owner_user_id
     FROM guild_members gm
     JOIN guilds g ON g.id = gm.guild_id
     WHERE gm.user_id=$1`,
    [userId]
  );
  const guild = r.rows[0] as { id: string; name: string; capacity: number; owner_user_id: string } | undefined;
  if (!guild) return res.json({ guild: null });

  const members = await pgPool.query(
    `SELECT u.id, u.username, gm.role, gm.joined_at
     FROM guild_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.guild_id=$1
     ORDER BY gm.joined_at ASC`,
    [guild.id]
  );

  return res.json({ guild, members: members.rows });
});

const InviteSchema = z.object({ targetUsername: z.string().min(3).max(20) });

// Owner invites a user by username
router.post('/guilds/invites', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const parsed = InviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });

  // Ensure inviter is owner
  const g = await pgPool.query(
    `SELECT g.id as guild_id, g.owner_user_id, g.capacity
     FROM guild_members gm
     JOIN guilds g ON g.id = gm.guild_id
     WHERE gm.user_id=$1`,
    [userId]
  );
  const row = g.rows[0] as { guild_id: string; owner_user_id: string; capacity: number } | undefined;
  if (!row) return res.status(400).json({ error: 'NOT_IN_GUILD' });
  if (row.owner_user_id !== userId) return res.status(403).json({ error: 'ONLY_OWNER' });

  const { lower: targetLower } = normalizeCaseInsensitiveName(parsed.data.targetUsername);
  const targetUser = await pgPool.query(`SELECT id, username FROM users WHERE username_lower=$1`, [targetLower]);
  const target = targetUser.rows[0] as { id: string; username: string } | undefined;
  if (!target) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  if (target.id === userId) return res.status(400).json({ error: 'CANNOT_INVITE_SELF' });

  // Target must not already be in a guild
  const existing = await pgPool.query(`SELECT guild_id FROM guild_members WHERE user_id=$1`, [target.id]);
  if (existing.rows.length) return res.status(409).json({ error: 'TARGET_ALREADY_IN_GUILD' });

  // Must not already have a pending invite from this guild
  const pending = await pgPool.query(
    `SELECT id FROM guild_invites WHERE guild_id=$1 AND invited_user_id=$2 AND status='PENDING'`,
    [row.guild_id, target.id]
  );
  if (pending.rows.length) return res.status(409).json({ error: 'INVITE_ALREADY_PENDING' });

  const inv = await pgPool.query(
    `INSERT INTO guild_invites (guild_id, invited_user_id, invited_by_user_id, status)
     VALUES ($1,$2,$3,'PENDING')
     RETURNING id`,
    [row.guild_id, target.id, userId]
  );

  return res.json({ inviteId: inv.rows[0].id, targetUser: { id: target.id, username: target.username } });
});

// List my pending invites
router.get('/guilds/invites', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const r = await pgPool.query(
    `SELECT gi.id, gi.guild_id, g.name as guild_name, gi.status, gi.created_at
     FROM guild_invites gi
     JOIN guilds g ON g.id = gi.guild_id
     WHERE gi.invited_user_id=$1 AND gi.status='PENDING'
     ORDER BY gi.created_at DESC`,
    [userId]
  );
  return res.json({ invites: r.rows });
});

// Approve invite (invited user)
router.post('/guilds/invites/:id/approve', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const inviteId = req.params.id;

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const inv = await client.query(
      `SELECT id, guild_id, status FROM guild_invites WHERE id=$1 AND invited_user_id=$2 FOR UPDATE`,
      [inviteId, userId]
    );
    const invite = inv.rows[0] as { id: string; guild_id: string; status: string } | undefined;
    if (!invite) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'INVITE_NOT_FOUND' });
    }
    if (invite.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'INVITE_NOT_PENDING' });
    }

    // Ensure user still not in a guild
    const existing = await client.query(`SELECT guild_id FROM guild_members WHERE user_id=$1`, [userId]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'ALREADY_IN_GUILD' });
    }

    // Check capacity
    const cap = await client.query(`SELECT capacity FROM guilds WHERE id=$1`, [invite.guild_id]);
    const capacity = Number((cap.rows[0] as any)?.capacity ?? 5);
    const count = await client.query(`SELECT COUNT(*)::int AS c FROM guild_members WHERE guild_id=$1`, [invite.guild_id]);
    const membersCount = Number((count.rows[0] as any)?.c ?? 0);
    if (membersCount >= capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'GUILD_FULL' });
    }

    await client.query(`INSERT INTO guild_members (user_id, guild_id, role) VALUES ($1,$2,'MEMBER')`, [userId, invite.guild_id]);
    await client.query(
      `UPDATE guild_invites SET status='APPROVED', responded_at=NOW() WHERE id=$1`,
      [invite.id]
    );

    await client.query('COMMIT');

    await redis.set(`user:${userId}:guild`, invite.guild_id, { EX: 60 });
    return res.json({ ok: true, guildId: invite.guild_id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[approve invite]', e);
    return res.status(500).json({ error: 'INTERNAL' });
  } finally {
    client.release();
  }
});

router.post('/guilds/invites/:id/reject', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const inviteId = req.params.id;
  const r = await pgPool.query(
    `UPDATE guild_invites SET status='REJECTED', responded_at=NOW() WHERE id=$1 AND invited_user_id=$2 AND status='PENDING'`,
    [inviteId, userId]
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'INVITE_NOT_FOUND' });
  return res.json({ ok: true });
});

router.post('/guilds/leave', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const r = await pgPool.query(
    `SELECT gm.guild_id, gm.role, g.owner_user_id
     FROM guild_members gm JOIN guilds g ON g.id = gm.guild_id
     WHERE gm.user_id=$1`,
    [userId]
  );
  const row = r.rows[0] as { guild_id: string; role: string; owner_user_id: string } | undefined;
  if (!row) return res.status(400).json({ error: 'NOT_IN_GUILD' });
  if (row.owner_user_id === userId) return res.status(409).json({ error: 'OWNER_CANNOT_LEAVE' });

  await pgPool.query(`DELETE FROM guild_members WHERE user_id=$1`, [userId]);
  await redis.set(`user:${userId}:guild`, '', { EX: 60 });
  return res.json({ ok: true });
});

export default router;
