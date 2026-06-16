CREATE TABLE IF NOT EXISTS user_dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_type VARCHAR(100) NOT NULL,
  widget_config JSONB,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_dashboard_widgets_widget_type_not_blank_check CHECK (
    length(trim(widget_type)) > 0
  ),
  CONSTRAINT user_dashboard_widgets_position_check CHECK (position >= 0 AND position <= 19)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user
  ON user_dashboard_widgets(user_id, position);

ALTER TABLE user_dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS user_recent_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_id VARCHAR(100) NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_recent_charts_chart_id_not_blank_check CHECK (
    length(trim(chart_id)) > 0
  ),
  CONSTRAINT user_recent_charts_user_chart_unique UNIQUE(user_id, chart_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_charts_user
  ON user_recent_charts(user_id, viewed_at DESC);

ALTER TABLE user_recent_charts ENABLE ROW LEVEL SECURITY;
