-- Durable subtitle quotes and worker state. Wallet history stays in app_receipts/app_jobs.
CREATE TABLE IF NOT EXISTS subtitle_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_origin TEXT NOT NULL CHECK(auth_origin IN ('toolbox-session','studio-session','oauth')),
  oauth_client_id TEXT,
  studio_project_id TEXT,
  operation_kind TEXT NOT NULL CHECK(operation_kind IN ('transcribe','render')),
  state TEXT NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','queued','processing','submitting','provider-pending','completed','failed')),
  request_snapshot JSONB NOT NULL,
  pricing_snapshot JSONB NOT NULL,
  export_estimate JSONB,
  job_id TEXT UNIQUE,
  provider_request_id TEXT,
  prepared_audio JSONB,
  result JSONB,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  lease_until TIMESTAMPTZ,
  lease_token TEXT,
  last_observed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((auth_origin = 'studio-session') = (studio_project_id IS NOT NULL)),
  CHECK (auth_origin = 'oauth' OR oauth_client_id IS NULL)
);
CREATE INDEX IF NOT EXISTS subtitle_operations_pending_idx
  ON subtitle_operations(last_observed_at NULLS FIRST, created_at)
  WHERE state IN ('queued','provider-pending','processing');
CREATE INDEX IF NOT EXISTS subtitle_operations_owner_idx ON subtitle_operations(user_id,created_at DESC,id);
