CREATE TABLE IF NOT EXISTS user_market_signal_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selected_signal_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_market_signal_preferences_selected_array_check CHECK (
    jsonb_typeof(selected_signal_names) = 'array'
  )
);

ALTER TABLE user_market_signal_preferences ENABLE ROW LEVEL SECURITY;
