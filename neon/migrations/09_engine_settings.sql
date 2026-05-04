CREATE TABLE IF NOT EXISTS engine_settings (
  engine_id TEXT PRIMARY KEY,
  options JSONB,
  pricing JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS engine_settings_updated_idx ON engine_settings (updated_at DESC);
