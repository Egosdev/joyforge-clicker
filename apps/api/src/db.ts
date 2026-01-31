import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { env } from './config';

export const pgPool = new Pool({ connectionString: env.POSTGRES_URL });

/**
 * Simple idempotent migration runner:
 * - runs every *.sql file in /app/db/migrations sorted by name
 * - expects migrations to be idempotent (IF NOT EXISTS, etc.)
 */
export async function runMigrations(migrationsDir: string) {
  const entries = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of entries) {
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[migrate] ${file}`);
    await pgPool.query(sql);
  }
}
