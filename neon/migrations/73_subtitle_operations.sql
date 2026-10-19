-- Durable subtitle quotes and worker state. Wallet history stays in app_receipts/app_jobs.
CREATE TABLE IF NOT EXISTS subtitle_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  auth_origin TEXT NOT NULL CHECK(auth_origin IN ('toolbox-session','studio-session','oauth')),
  oauth_client_id TEXT,
  studio_project_id TEXT,
  operation_kind TEXT NOT NULL CHECK(operation_kind IN ('transcribe','render','mix-transcribe')),
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
  WHERE state IN ('queued','provider-pending','processing','submitting');
CREATE INDEX IF NOT EXISTS subtitle_operations_owner_idx ON subtitle_operations(user_id,created_at DESC,id);

-- The existing quote ledger owns account spending aggregation, including subtitle audio work.
ALTER TABLE mcp_generation_quotes DROP CONSTRAINT IF EXISTS generation_quote_origin_scope;
ALTER TABLE mcp_generation_quotes ADD CONSTRAINT generation_quote_origin_scope CHECK ((
  (auth_origin = 'oauth' AND studio_project_id IS NULL)
  OR (auth_origin = 'studio-session' AND oauth_client_id IS NULL
      AND funding_mode = 'wallet' AND request_json->>'surface' IN ('image','video','audio')
      AND length(studio_project_id) BETWEEN 1 AND 128 AND studio_project_id = btrim(studio_project_id))
  OR (auth_origin = 'toolbox-session' AND oauth_client_id IS NULL
      AND studio_project_id IS NULL AND funding_mode = 'wallet'
      AND request_json->>'surface' IN ('image','video','audio'))
) IS TRUE);
