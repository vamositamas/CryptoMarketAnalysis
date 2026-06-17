CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_id VARCHAR(100) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  condition VARCHAR(50) NOT NULL,
  threshold_value DECIMAL(18, 6) NOT NULL,
  alert_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_evaluated_at TIMESTAMPTZ,
  triggered_at TIMESTAMPTZ,
  CONSTRAINT user_alerts_chart_id_not_blank_check CHECK (length(trim(chart_id)) > 0),
  CONSTRAINT user_alerts_metric_name_not_blank_check CHECK (length(trim(metric_name)) > 0),
  CONSTRAINT user_alerts_condition_check CHECK (
    condition IN ('crosses_above', 'crosses_below', 'greater_than', 'less_than', 'equals')
  ),
  CONSTRAINT user_alerts_alert_name_not_blank_check CHECK (length(trim(alert_name)) > 0),
  CONSTRAINT user_alerts_status_check CHECK (status IN ('active', 'triggered', 'paused'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_status
  ON user_alerts(user_id, status);

CREATE INDEX IF NOT EXISTS idx_alerts_evaluation
  ON user_alerts(status, last_evaluated_at)
  WHERE status = 'active';

ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES user_alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metric_value DECIMAL(18, 6) NOT NULL,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_alert
  ON alert_triggers(alert_id, triggered_at DESC);

ALTER TABLE alert_triggers ENABLE ROW LEVEL SECURITY;
