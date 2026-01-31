import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.string().optional().default('development'),
  REDIS_URL: z.string().min(1),
  POSTGRES_URL: z.string().min(1),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().optional().default(1000),
  FLUSH_INTERVAL_MS: z.coerce.number().optional().default(2000),
  TOP_N: z.coerce.number().optional().default(100)
});

export const env = EnvSchema.parse(process.env);
