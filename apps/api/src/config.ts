import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().optional().default(8080),

  PUBLIC_APP_ORIGIN: z.string().optional().default('http://localhost:5173'),

  SESSION_SECRET: z.string().min(16),
  SESSION_TTL_DAYS: z.coerce.number().optional().default(7),

  REDIS_URL: z.string().min(1),
  POSTGRES_URL: z.string().min(1),

  COOKIE_DOMAIN: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);

export const isProd = env.NODE_ENV === 'production';
