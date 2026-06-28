ALTER TABLE user_dashboard_widgets
  DROP CONSTRAINT IF EXISTS user_dashboard_widgets_position_check;

ALTER TABLE user_dashboard_widgets
  ADD CONSTRAINT user_dashboard_widgets_position_check CHECK (position >= 0 AND position <= 39);
