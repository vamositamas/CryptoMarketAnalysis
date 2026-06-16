CREATE TABLE IF NOT EXISTS user_chart_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chart_id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  date DATE,
  price_level DECIMAL(18, 2),
  text TEXT,
  start_date DATE,
  start_price DECIMAL(18, 2),
  end_date DATE,
  end_price DECIMAL(18, 2),
  color VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_chart_annotations_chart_id_check CHECK (length(trim(chart_id)) > 0),
  CONSTRAINT user_chart_annotations_type_check CHECK (type IN ('note', 'trendline')),
  CONSTRAINT user_chart_annotations_note_fields_check CHECK (
    type <> 'note'
    OR (
      date IS NOT NULL
      AND price_level IS NOT NULL
      AND text IS NOT NULL
      AND length(trim(text)) > 0
    )
  ),
  CONSTRAINT user_chart_annotations_trendline_fields_check CHECK (
    type <> 'trendline'
    OR (
      start_date IS NOT NULL
      AND start_price IS NOT NULL
      AND end_date IS NOT NULL
      AND end_price IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_user_chart_annotations_user_chart
  ON user_chart_annotations(user_id, chart_id, created_at DESC);

ALTER TABLE user_chart_annotations ENABLE ROW LEVEL SECURITY;
