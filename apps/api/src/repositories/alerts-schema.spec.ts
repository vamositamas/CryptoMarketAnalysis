import { readFileSync } from 'fs';
import { join } from 'path';

const workspaceRoot = join(__dirname, '../../../../');
const migration = readFileSync(
  join(workspaceRoot, 'database/migrations/009_create_alerts_schema.sql'),
  'utf8',
);
const schema = readFileSync(join(workspaceRoot, 'database/schema.sql'), 'utf8');

describe('alerts database schema', () => {
  it('creates the user_alerts table with required columns, constraints, and cascade delete', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS user_alerts');
    expect(migration).toContain('user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(migration).toContain('chart_id VARCHAR(100) NOT NULL');
    expect(migration).toContain('metric_name VARCHAR(100) NOT NULL');
    expect(migration).toContain('condition VARCHAR(50) NOT NULL');
    expect(migration).toContain('threshold_value DECIMAL(18, 6) NOT NULL');
    expect(migration).toContain('alert_name VARCHAR(255) NOT NULL');
    expect(migration).toContain("status VARCHAR(50) NOT NULL DEFAULT 'active'");
    expect(migration).toContain('last_evaluated_at TIMESTAMPTZ');
    expect(migration).toContain('triggered_at TIMESTAMPTZ');
  });

  it('enforces condition and status domain constraints', () => {
    expect(migration).toContain(
      "condition IN ('crosses_above', 'crosses_below', 'greater_than', 'less_than', 'equals')",
    );
    expect(migration).toContain("status IN ('active', 'triggered', 'paused')");
  });

  it('creates indexes optimising user-status lookups and active-alert evaluation', () => {
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_alerts_user_status');
    expect(migration).toContain('ON user_alerts(user_id, status)');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_alerts_evaluation');
    expect(migration).toContain('ON user_alerts(status, last_evaluated_at)');
    expect(migration).toContain("WHERE status = 'active'");
  });

  it('creates the alert_triggers table with cascade delete and notification tracking', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS alert_triggers');
    expect(migration).toContain('alert_id UUID NOT NULL REFERENCES user_alerts(id) ON DELETE CASCADE');
    expect(migration).toContain('metric_value DECIMAL(18, 6) NOT NULL');
    expect(migration).toContain('notification_sent BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('notification_sent_at TIMESTAMPTZ');
  });

  it('creates an index on alert_triggers ordered by most recent first', () => {
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_alert_triggers_alert');
    expect(migration).toContain('ON alert_triggers(alert_id, triggered_at DESC)');
  });

  it('enables row-level security on both tables', () => {
    expect(migration).toContain('ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE alert_triggers ENABLE ROW LEVEL SECURITY');
  });

  it('keeps the aggregate schema reference in migration order', () => {
    expect(schema).toContain('\\i database/migrations/009_create_alerts_schema.sql');
  });
});
