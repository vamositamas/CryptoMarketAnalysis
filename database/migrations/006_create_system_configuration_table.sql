CREATE TABLE IF NOT EXISTS system_configuration (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT system_configuration_key_not_blank_check CHECK (length(trim(key)) > 0)
);

ALTER TABLE system_configuration ENABLE ROW LEVEL SECURITY;

INSERT INTO system_configuration (key, value)
VALUES
  ('refresh_frequency', 'daily'),
  ('historical_depth', 'all_time')
ON CONFLICT (key) DO NOTHING;
