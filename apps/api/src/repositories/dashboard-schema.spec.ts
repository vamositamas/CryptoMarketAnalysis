import { readFileSync } from 'fs';
import { join } from 'path';

const workspaceRoot = join(__dirname, '../../../../');
const migration = readFileSync(
  join(workspaceRoot, 'database/migrations/008_create_dashboard_schema.sql'),
  'utf8',
);
const schema = readFileSync(join(workspaceRoot, 'database/schema.sql'), 'utf8');

describe('dashboard database schema', () => {
  it('creates the user dashboard widgets table with position bounds and cascade delete', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS user_dashboard_widgets');
    expect(migration).toContain('user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(migration).toContain('widget_type VARCHAR(100) NOT NULL');
    expect(migration).toContain('widget_config JSONB');
    expect(migration).toContain('position INTEGER NOT NULL');
    expect(migration).toContain(
      'CONSTRAINT user_dashboard_widgets_position_check CHECK (position >= 0 AND position <= 39)',
    );
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user');
    expect(migration).toContain('ON user_dashboard_widgets(user_id, position)');
  });

  it('creates the user recent charts table with a per-user unique chart constraint', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS user_recent_charts');
    expect(migration).toContain('user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(migration).toContain('chart_id VARCHAR(100) NOT NULL');
    expect(migration).toContain(
      'CONSTRAINT user_recent_charts_user_chart_unique UNIQUE(user_id, chart_id)',
    );
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_recent_charts_user');
    expect(migration).toContain('ON user_recent_charts(user_id, viewed_at DESC)');
  });

  it('keeps the aggregate schema reference in migration order', () => {
    expect(schema).toContain('\\i database/migrations/008_create_dashboard_schema.sql');
    expect(schema).toContain('\\i database/migrations/015_expand_dashboard_widget_limit.sql');
  });
});
