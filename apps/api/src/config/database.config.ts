import { Pool } from 'pg';

let pool: Pool | undefined;

export function getDatabasePool(): Pool | undefined {
  const connectionString = process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    return undefined;
  }

  pool ??= new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}
