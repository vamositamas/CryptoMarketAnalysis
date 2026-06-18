CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  paypal_order_id VARCHAR(255),
  paypal_transaction_id TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  user_upgraded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  CONSTRAINT check_donation_amount_positive CHECK (amount > 0),
  CONSTRAINT check_donation_status CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  CONSTRAINT check_donation_currency_length CHECK (char_length(currency) = 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_donations_paypal_order
  ON donations(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_donations_user
  ON donations(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_donations_status
  ON donations(status, completed_at DESC);
