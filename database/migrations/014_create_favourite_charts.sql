CREATE TABLE IF NOT EXISTS user_favourite_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_favourite_charts_chart_id_not_blank_check CHECK (
    length(trim(chart_id)) > 0
  ),
  CONSTRAINT user_favourite_charts_user_chart_unique UNIQUE(user_id, chart_id)
);

CREATE INDEX IF NOT EXISTS idx_favourite_charts_user
  ON user_favourite_charts(user_id, created_at DESC);

ALTER TABLE user_favourite_charts ENABLE ROW LEVEL SECURITY;
