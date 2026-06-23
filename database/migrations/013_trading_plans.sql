CREATE TABLE IF NOT EXISTS trading_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Plan',
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'neutral')),
  entry_price NUMERIC(20, 2) NOT NULL,
  target_price NUMERIC(20, 2),
  stop_loss NUMERIC(20, 2),
  position_size_usd NUMERIC(20, 2),
  risk_percent NUMERIC(5, 2),
  expiry_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  close_price NUMERIC(20, 2),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trading_plans_user_id ON trading_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_plans_status ON trading_plans(status);

ALTER TABLE trading_plans ENABLE ROW LEVEL SECURITY;
