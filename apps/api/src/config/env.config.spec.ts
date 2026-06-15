import { loadApiEnv } from './env.config';

describe('loadApiEnv', () => {
  const originalDatabaseUrl = process.env.SUPABASE_DATABASE_URL;

  afterEach(() => {
    process.env.SUPABASE_DATABASE_URL = originalDatabaseUrl;
  });

  it('loads quoted values from apps/api/.env when they are not already set', () => {
    delete process.env.SUPABASE_DATABASE_URL;

    loadApiEnv();

    expect(process.env.SUPABASE_DATABASE_URL).toMatch(/^postgresql:\/\//);
  });

  it('does not override existing environment values', () => {
    process.env.SUPABASE_DATABASE_URL = 'postgresql://already-set';

    loadApiEnv();

    expect(process.env.SUPABASE_DATABASE_URL).toBe('postgresql://already-set');
  });
});
