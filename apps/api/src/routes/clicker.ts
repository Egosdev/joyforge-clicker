import { Router } from 'express';
import { requireAuth } from '../middlewares';
import { enforcePerSecondLimit } from '../services/rateLimit';
import { getUserGuildId } from '../services/state';
import { applyClick } from '../services/clicker';
import type { ClickResponse } from '@joyforge/shared';

const router = Router();

// Placeholders for future upgrades
const personalMultiplier = 1;
const guildMultiplier = 1;

router.post('/click', requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const lim = await enforcePerSecondLimit({ prefix: 'rl:click', userId, maxPerSecond: 20 });
  if (!lim.ok) return res.status(429).json({ error: 'TOO_MANY_CLICKS' });

  const gain = 1 * personalMultiplier;
  const guildGain = gain * guildMultiplier;
  const guildId = await getUserGuildId(userId);

  const r = await applyClick(userId, gain, guildGain, guildId);

  const response: ClickResponse = {
    gain,
    user: { totalUsd: r.userUsd, totalClicks: r.userClicks }
  };

  if (guildId && r.guildVault !== undefined && r.guildScore !== undefined && r.guildProgress !== undefined && r.guildTarget !== undefined) {
    response.guild = {
      guildId,
      vaultTotal: r.guildVault,
      goal: { progress: r.guildProgress, target: r.guildTarget, score: r.guildScore }
    };
  }

  return res.json(response);
});

export default router;
