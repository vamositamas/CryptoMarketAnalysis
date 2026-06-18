import { Pool } from 'pg';

let pool: Pool | undefined;

export function getDatabasePool(): Pool | undefined {
  const connectionString = process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    return undefined;
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  pool ??= new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}
