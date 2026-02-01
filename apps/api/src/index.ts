import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config';
import { initRedis } from './redis';
import { runMigrations } from './db';
import { attachSession } from './session';
import { loadClickScripts } from './services/clicker';
import { attachSocket } from './socket';

import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import clickerRoutes from './routes/clicker';
import guildRoutes from './routes/guilds';
import leaderboardRoutes from './routes/leaderboard';

async function main() {
  await initRedis();
  await runMigrations('/app/db/migrations');
  await loadClickScripts();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.PUBLIC_APP_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: '64kb' }));

  attachSession(app);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRoutes);
  app.use(meRoutes);
  app.use(clickerRoutes);
  app.use(guildRoutes);
  app.use(leaderboardRoutes);

  const server = http.createServer(app);
  await attachSocket(server);

  server.listen(env.PORT, () => {
    console.log(`[api] listening on :${env.PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
