import { readFileSync } from 'fs';
import { join } from 'path';

const workspaceRoot = join(__dirname, '../../../../');
const migration = readFileSync(
  join(
    workspaceRoot,
    'database/migrations/005_create_bitcoin_metrics_tables.sql',
  ),
  'utf8',
);
const schema = readFileSync(join(workspaceRoot, 'database/schema.sql'), 'utf8');

describe('bitcoin metrics database schema', () => {
  it('creates the Bitcoin price daily table with date uniqueness and query index', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS bitcoin_price_daily');
    expect(migration).toContain('date DATE UNIQUE NOT NULL');
    expect(migration).toContain('price_usd DECIMAL(18, 2) NOT NULL');
    expect(migration).toContain('market_cap_usd BIGINT');
    expect(migration).toContain('circulating_supply BIGINT');
    expect(migration).toContain('price_change_24h_percent DECIMAL(5, 2)');
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS idx_bitcoin_price_date',
    );
    expect(migration).toContain('ON bitcoin_price_daily(date DESC)');
  });

  it('creates the Bitcoin metrics daily table with unique metric points and date index', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS bitcoin_metrics_daily');
    expect(migration).toContain('date DATE NOT NULL');
    expect(migration).toContain('metric_name VARCHAR(100) NOT NULL');
    expect(migration).toContain('metric_value DECIMAL(18, 6) NOT NULL');
    expect(migration).toContain(
      'CONSTRAINT bitcoin_metrics_daily_date_metric_name_unique UNIQUE(date, metric_name)',
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS idx_bitcoin_metrics_date_name',
    );
    expect(migration).toContain('ON bitcoin_metrics_daily(date DESC, metric_name)');
  });

  it('keeps the aggregate schema reference in migration order', () => {
    expect(schema).toContain(
      '\\i database/migrations/005_create_bitcoin_metrics_tables.sql',
    );
  });
});
