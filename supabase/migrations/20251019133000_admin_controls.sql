CREATE TABLE IF NOT EXISTS app_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS engine_overrides (
  engine_id TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  availability TEXT,
  status TEXT,
  latency_tier TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);
