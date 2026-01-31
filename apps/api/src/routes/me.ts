import { Router } from 'express';
import { requireAuth } from '../middlewares';
import { getUserTotals, getUserGuildId, getGuildState } from '../services/state';
import { pgPool } from '../db';

const router = Router();

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const u = await pgPool.query(`SELECT id, username FROM users WHERE id=$1`, [userId]);
  const userRow = u.rows[0] as { id: string; username: string } | undefined;
  if (!userRow) return res.status(404).json({ error: 'USER_NOT_FOUND' });

  const totals = await getUserTotals(userId);
  const guildId = await getUserGuildId(userId);
  const guild = guildId ? await getGuildState(guildId) : null;

  return res.json({
    user: { id: userRow.id, username: userRow.username, ...totals },
    guild
  });
});

export default router;
