CREATE TABLE IF NOT EXISTS bitcoin_price_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  price_usd DECIMAL(18, 2) NOT NULL,
  market_cap_usd BIGINT,
  circulating_supply BIGINT,
  price_change_24h_percent DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bitcoin_price_daily_price_usd_check CHECK (price_usd >= 0),
  CONSTRAINT bitcoin_price_daily_market_cap_usd_check CHECK (
    market_cap_usd IS NULL OR market_cap_usd >= 0
  ),
  CONSTRAINT bitcoin_price_daily_circulating_supply_check CHECK (
    circulating_supply IS NULL OR circulating_supply >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_bitcoin_price_date
  ON bitcoin_price_daily(date DESC);

ALTER TABLE bitcoin_price_daily ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bitcoin_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(18, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT bitcoin_metrics_daily_metric_name_not_blank_check CHECK (
    length(trim(metric_name)) > 0
  ),
  CONSTRAINT bitcoin_metrics_daily_date_metric_name_unique UNIQUE(date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_bitcoin_metrics_date_name
  ON bitcoin_metrics_daily(date DESC, metric_name);

ALTER TABLE bitcoin_metrics_daily ENABLE ROW LEVEL SECURITY;
