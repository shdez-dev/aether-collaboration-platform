ALTER TABLE user_dashboards
  ADD COLUMN background_color VARCHAR(24) NOT NULL DEFAULT 'default';

ALTER TABLE user_dashboards
  ADD CONSTRAINT user_dashboards_background_color_check
    CHECK (background_color IN ('default', 'lavender', 'sky', 'mint', 'peach', 'rose', 'butter'));
