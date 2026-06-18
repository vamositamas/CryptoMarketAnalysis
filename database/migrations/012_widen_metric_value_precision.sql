-- DECIMAL(18,6) overflows for hash_rate (~6e20 H/s) and mining_difficulty (~9e13).
-- NUMERIC with no constraints allows arbitrary precision.
ALTER TABLE bitcoin_metrics_daily
  ALTER COLUMN metric_value TYPE NUMERIC;
