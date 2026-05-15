CREATE TABLE IF NOT EXISTS provider_element_assets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  provider TEXT NOT NULL,
  provider_model TEXT,
  source_fingerprint TEXT NOT NULL,
  source_snapshot JSONB,
  provider_element_id TEXT,
  provider_task_id TEXT,
  status TEXT NOT NULL,
  reference_type TEXT,
  request_snapshot JSONB,
  response_snapshot JSONB,
  provider_cost_usd NUMERIC(12, 6),
  provider_cost_units NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, source_fingerprint)
);

CREATE INDEX IF NOT EXISTS provider_element_assets_provider_fingerprint_idx
  ON provider_element_assets (provider, source_fingerprint);

CREATE INDEX IF NOT EXISTS provider_element_assets_user_provider_idx
  ON provider_element_assets (user_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS provider_element_assets_provider_task_idx
  ON provider_element_assets (provider, provider_task_id)
  WHERE provider_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION set_provider_element_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS provider_element_assets_set_updated_at ON provider_element_assets;
CREATE TRIGGER provider_element_assets_set_updated_at
BEFORE UPDATE ON provider_element_assets
FOR EACH ROW
EXECUTE FUNCTION set_provider_element_assets_updated_at();
