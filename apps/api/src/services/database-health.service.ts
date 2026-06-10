import { getDatabasePool } from '../config/database.config';

export async function checkDatabaseConnection(): Promise<boolean> {
  const pool = getDatabasePool();

  if (!pool) {
    return false;
  }

  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed', error);
    return false;
  }
}
