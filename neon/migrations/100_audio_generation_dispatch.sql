-- Explicit prerequisite for durable Audio dispatch. Never installed from a request path.
CREATE TABLE IF NOT EXISTS audio_generation_dispatch (
  quote_id UUID PRIMARY KEY REFERENCES mcp_generation_quotes(quote_id) ON DELETE RESTRICT,
  job_id TEXT NOT NULL UNIQUE REFERENCES app_jobs(job_id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL,
  oauth_client_id TEXT,
  auth_origin TEXT NOT NULL,
  studio_project_id TEXT,
  request_hash TEXT NOT NULL,
  execution_json JSONB NOT NULL,
  execution_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'queued',
  claim_id UUID,
  failure_code TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT audio_dispatch_user CHECK ((length(user_id) BETWEEN 1 AND 128 AND user_id=btrim(user_id)) IS TRUE),
  CONSTRAINT audio_dispatch_scope CHECK ((
    (auth_origin='oauth' AND length(oauth_client_id) BETWEEN 1 AND 256 AND oauth_client_id=btrim(oauth_client_id) AND studio_project_id IS NULL)
    OR (auth_origin='studio-session' AND oauth_client_id IS NULL AND length(studio_project_id) BETWEEN 1 AND 128 AND studio_project_id=btrim(studio_project_id))
    OR (auth_origin='toolbox-session' AND oauth_client_id IS NULL AND studio_project_id IS NULL)
  ) IS TRUE),
  CONSTRAINT audio_dispatch_hashes CHECK ((request_hash ~ '^[a-f0-9]{64}$' AND execution_hash ~ '^[a-f0-9]{64}$') IS TRUE),
  CONSTRAINT audio_dispatch_payload CHECK ((
    jsonb_typeof(execution_json)='object' AND octet_length(execution_json::text)<=131072
    AND execution_json->>'userId'=user_id AND execution_json->>'jobId'=job_id
    AND jsonb_typeof(execution_json->'prepared')='object'
  ) IS TRUE),
  CONSTRAINT audio_dispatch_state CHECK ((state IN ('queued','processing','completed','failed','ambiguous')) IS TRUE),
  CONSTRAINT audio_dispatch_claim CHECK (((state='queued' AND claim_id IS NULL) OR (state<>'queued' AND claim_id IS NOT NULL)) IS TRUE),
  CONSTRAINT audio_dispatch_failure CHECK ((failure_code IS NULL OR failure_code IN ('validation_failed','execution_unknown','reconciliation_required')) IS TRUE),
  CONSTRAINT audio_dispatch_clock CHECK ((observed_at>=queued_at) IS TRUE)
);

CREATE INDEX IF NOT EXISTS audio_dispatch_queued ON audio_generation_dispatch(queued_at,quote_id) WHERE state='queued';

CREATE OR REPLACE FUNCTION enforce_audio_dispatch_insert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state<>'queued' OR NEW.claim_id IS NOT NULL OR NEW.failure_code IS NOT NULL THEN
    RAISE EXCEPTION 'Audio dispatch must start queued';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM mcp_generation_quotes q JOIN app_jobs j ON j.job_id=q.job_id
      JOIN app_receipts c ON c.job_id=j.job_id AND c.type='charge'
    WHERE q.quote_id=NEW.quote_id AND q.job_id=NEW.job_id AND q.user_id=NEW.user_id
      AND q.oauth_client_id IS NOT DISTINCT FROM NEW.oauth_client_id
      AND q.auth_origin=NEW.auth_origin AND q.studio_project_id IS NOT DISTINCT FROM NEW.studio_project_id
      AND q.state='claimed' AND q.funding_mode='wallet' AND q.request_json->>'surface'='audio'
      AND q.request_hash=NEW.request_hash AND q.price_cents>0
      AND j.user_id=q.user_id AND j.surface='audio' AND j.status='pending' AND j.payment_status='paid_wallet'
      AND j.final_price_cents=q.price_cents AND j.currency=q.currency
      AND j.pricing_snapshot=q.pricing_snapshot-'mcpAudio'
      AND c.user_id=j.user_id AND c.surface=j.surface AND c.amount_cents=j.final_price_cents
      AND c.currency=j.currency AND c.billing_product_key=j.billing_product_key AND c.pricing_snapshot=j.pricing_snapshot
      AND NEW.execution_json->'prepared'->'pricingSnapshot'=j.pricing_snapshot
      AND NEW.execution_json->'prepared'->'packConfig'->>'engineId'=j.engine_id
      AND NEW.execution_json->'prepared'->'packConfig'->>'billingProductKey'=j.billing_product_key
      AND (SELECT count(*) FROM app_receipts WHERE job_id=j.job_id AND type='charge')=1
  ) THEN RAISE EXCEPTION 'Audio dispatch reservation binding is invalid'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audio_dispatch_insert ON audio_generation_dispatch;
CREATE TRIGGER audio_dispatch_insert BEFORE INSERT ON audio_generation_dispatch FOR EACH ROW EXECUTE FUNCTION enforce_audio_dispatch_insert();

CREATE OR REPLACE FUNCTION enforce_audio_dispatch_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.quote_id IS DISTINCT FROM OLD.quote_id OR NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.oauth_client_id IS DISTINCT FROM OLD.oauth_client_id
    OR NEW.auth_origin IS DISTINCT FROM OLD.auth_origin OR NEW.studio_project_id IS DISTINCT FROM OLD.studio_project_id
    OR NEW.request_hash IS DISTINCT FROM OLD.request_hash OR NEW.execution_json IS DISTINCT FROM OLD.execution_json
    OR NEW.execution_hash IS DISTINCT FROM OLD.execution_hash OR NEW.queued_at IS DISTINCT FROM OLD.queued_at THEN
    RAISE EXCEPTION 'Audio dispatch scope and execution are immutable';
  END IF;
  IF NEW.observed_at<OLD.observed_at THEN RAISE EXCEPTION 'Audio dispatch observation cannot move backwards'; END IF;
  IF NEW.claim_id IS DISTINCT FROM OLD.claim_id AND NOT (OLD.state='queued' AND NEW.state='processing' AND OLD.claim_id IS NULL AND NEW.claim_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Audio dispatch claim cannot be replaced';
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
    (OLD.state='queued' AND NEW.state='processing') OR (OLD.state='processing' AND NEW.state IN ('completed','failed','ambiguous'))
  ) THEN RAISE EXCEPTION 'Audio dispatch cannot be retried automatically'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audio_dispatch_update ON audio_generation_dispatch;
CREATE TRIGGER audio_dispatch_update BEFORE UPDATE ON audio_generation_dispatch FOR EACH ROW EXECUTE FUNCTION enforce_audio_dispatch_update();

REVOKE ALL ON audio_generation_dispatch FROM PUBLIC;
COMMENT ON TABLE audio_generation_dispatch IS 'Private trusted Audio executions. Processing and ambiguous attempts require reconciliation, never automatic retry.';
COMMENT ON COLUMN audio_generation_dispatch.execution_json IS 'Private provider execution input, including original reference URLs and prompts. Never return in tools, logs, analytics or status.';
