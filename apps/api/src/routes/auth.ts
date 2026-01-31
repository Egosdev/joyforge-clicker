import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { pgPool } from '../db';
import { normalizeCaseInsensitiveName } from '../utils';
import { redis } from '../redis';

const router = Router();

const RegisterSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(8).max(128)
});

const LoginSchema = RegisterSchema;

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });
  }

  const { display: username, lower: usernameLower } = normalizeCaseInsensitiveName(parsed.data.username);
  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });

  try {
    const result = await pgPool.query(
      `INSERT INTO users (username, username_lower, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, username`,
      [username, usernameLower, passwordHash]
    );
    const user = result.rows[0] as { id: string; username: string };

    await pgPool.query(`INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);

    // Cache username for leaderboard snapshots
    await redis.set(`user:${user.id}:username`, user.username);

    req.session.userId = user.id;
    return res.json({ user: { id: user.id, username: user.username } });
  } catch (e: any) {
    if (String(e?.message || '').includes('users_username_lower_uniq')) {
      return res.status(409).json({ error: 'USERNAME_TAKEN' });
    }
    console.error('[register]', e);
    return res.status(500).json({ error: 'INTERNAL' });
  }
});

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'VALIDATION', details: parsed.error.flatten() });
  }

  const { lower: usernameLower } = normalizeCaseInsensitiveName(parsed.data.username);
  const result = await pgPool.query(`SELECT id, username, password_hash FROM users WHERE username_lower=$1`, [usernameLower]);
  const row = result.rows[0] as { id: string; username: string; password_hash: string } | undefined;
  if (!row) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const ok = await argon2.verify(row.password_hash, parsed.data.password);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  // Cache username
  await redis.set(`user:${row.id}:username`, row.username);

  req.session.userId = row.id;
  return res.json({ user: { id: row.id, username: row.username } });
});

router.post('/logout', async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('joyforge.sid');
    return res.json({ ok: true });
  });
});

export default router;
