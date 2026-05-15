CREATE TABLE IF NOT EXISTS provider_attempts (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES app_jobs(id) ON DELETE CASCADE,
  attempt_index INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_model TEXT,
  status TEXT NOT NULL,
  provider_job_id TEXT,
  started_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_code TEXT,
  error_class TEXT,
  fallback_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_to_attempt_id BIGINT REFERENCES provider_attempts(id),
  request_snapshot JSONB,
  response_snapshot JSONB,
  provider_cost_usd NUMERIC(12, 6),
  provider_cost_units NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, attempt_index)
);

CREATE INDEX IF NOT EXISTS provider_attempts_job_attempt_idx
  ON provider_attempts (job_id, attempt_index);

CREATE INDEX IF NOT EXISTS provider_attempts_provider_job_idx
  ON provider_attempts (provider, provider_job_id)
  WHERE provider_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_attempts_status_updated_idx
  ON provider_attempts (status, updated_at);

CREATE INDEX IF NOT EXISTS provider_attempts_provider_created_idx
  ON provider_attempts (provider, created_at DESC);

CREATE OR REPLACE FUNCTION set_provider_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS provider_attempts_set_updated_at ON provider_attempts;
CREATE TRIGGER provider_attempts_set_updated_at
BEFORE UPDATE ON provider_attempts
FOR EACH ROW
EXECUTE FUNCTION set_provider_attempts_updated_at();
