-- Private paired cache authority. No public asset projection or runtime bootstrap.
-- Existing Draft outputs remain successful without a cache; no inferred historical backfill.
CREATE TABLE IF NOT EXISTS flux_draft_cache_sources (
  source_job_id text NOT NULL,
  source_output_id text NOT NULL,
  owner_id text NOT NULL,
  provider_request_id text NOT NULL,
  attempt_id bigint NOT NULL,
  fingerprint text NOT NULL,
  qualified_source jsonb NOT NULL,
  invalidated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_job_id, source_output_id),
  CHECK (qualified_source->>'fingerprint' = fingerprint),
  CHECK (qualified_source->>'ownerId' = owner_id),
  CHECK (qualified_source->>'providerRequestId' = provider_request_id)
);
REVOKE ALL ON flux_draft_cache_sources FROM PUBLIC;
