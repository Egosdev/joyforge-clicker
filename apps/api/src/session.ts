import session from 'express-session';
import RedisStore from 'connect-redis';
import type { Express } from 'express';
import { env, isProd } from './config';
import { redis } from './redis';

const dayMs = 24 * 60 * 60 * 1000;

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export function attachSession(app: Express) {
  const store = new RedisStore({ client: redis, prefix: 'sess:' });
  app.use(
    session({
      name: 'joyforge.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        domain: env.COOKIE_DOMAIN,
        maxAge: env.SESSION_TTL_DAYS * dayMs
      }
    })
  );
}
