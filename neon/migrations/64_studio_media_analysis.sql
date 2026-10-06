-- Explicit schema only. Does not activate a profile, price or credit grant.
CREATE TABLE IF NOT EXISTS studio_media_analysis_runs (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  project_id text NOT NULL REFERENCES studio_projects(id),
  request_key text NOT NULL,
  request_hash text NOT NULL,
  request_json jsonb NOT NULL,
  source_fingerprint text NOT NULL,
  policy_json jsonb NOT NULL,
  quote_json jsonb NOT NULL,
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','queued','running','completed','failed','unknown')),
  reserved_supplier_nano_usd bigint NOT NULL CHECK(reserved_supplier_nano_usd>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  worker_id uuid,
  started_at timestamptz,
  dispatched_at timestamptz,
  source_hash text,
  provider_snapshot jsonb,
  result_json jsonb,
  charged_credits integer CHECK(charged_credits>=0 AND charged_credits%10=0),
  error text,
  settled_at timestamptz,
  UNIQUE(user_id,project_id,request_key),
  CHECK((state IN ('completed','failed'))=(settled_at IS NOT NULL AND charged_credits IS NOT NULL)),
  CHECK(state='prepared' OR confirmed_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS studio_media_analysis_queue ON studio_media_analysis_runs(created_at) WHERE state='queued';
CREATE INDEX IF NOT EXISTS studio_media_analysis_owner ON studio_media_analysis_runs(user_id,project_id,created_at);
CREATE TABLE IF NOT EXISTS studio_analysis_credit_funding (
  call_id uuid PRIMARY KEY REFERENCES studio_media_analysis_runs(id),
  campaign_id text NOT NULL REFERENCES studio_assistance_campaigns(id),
  quoted_cents integer NOT NULL CHECK(quoted_cents>=0),
  charged_cents integer CHECK(charged_cents>=0 AND charged_cents<=quoted_cents),
  reserved_sponsored_nano_usd bigint NOT NULL CHECK(reserved_sponsored_nano_usd>=0),
  charged_sponsored_nano_usd bigint CHECK(charged_sponsored_nano_usd>=0),
  CHECK((charged_cents IS NULL)=(charged_sponsored_nano_usd IS NULL))
);
CREATE TABLE IF NOT EXISTS studio_analysis_credit_allocations (
  call_id uuid NOT NULL REFERENCES studio_analysis_credit_funding(call_id),
  lot_id uuid NOT NULL REFERENCES studio_assistance_credit_lots(id),
  reserved_credits bigint NOT NULL CHECK(reserved_credits>0 AND reserved_credits%10=0),
  charged_credits bigint CHECK(charged_credits>=0 AND charged_credits<=reserved_credits),
  released_at timestamptz,
  PRIMARY KEY(call_id,lot_id),
  CHECK(charged_credits IS NULL OR released_at IS NULL)
);
CREATE OR REPLACE FUNCTION enforce_studio_analysis_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mutable text[];
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Studio analysis financial evidence is immutable'; END IF;
  mutable:=CASE TG_TABLE_NAME
    WHEN 'studio_media_analysis_runs' THEN ARRAY['state','confirmed_at','worker_id','started_at','dispatched_at','source_hash','provider_snapshot','result_json','charged_credits','error','settled_at']
    WHEN 'studio_analysis_credit_funding' THEN ARRAY['charged_cents','charged_sponsored_nano_usd']
    ELSE ARRAY['charged_credits','released_at'] END;
  IF (to_jsonb(NEW)-mutable) IS DISTINCT FROM (to_jsonb(OLD)-mutable)
    OR (TG_TABLE_NAME='studio_media_analysis_runs' AND to_jsonb(OLD)->>'settled_at' IS NOT NULL AND NEW IS DISTINCT FROM OLD)
    OR (TG_TABLE_NAME='studio_media_analysis_runs' AND to_jsonb(OLD)->'provider_snapshot' <> 'null'::jsonb AND to_jsonb(NEW)->'provider_snapshot' IS DISTINCT FROM to_jsonb(OLD)->'provider_snapshot')
    OR (TG_TABLE_NAME='studio_analysis_credit_funding' AND to_jsonb(OLD)->>'charged_cents' IS NOT NULL AND NEW IS DISTINCT FROM OLD)
    OR (TG_TABLE_NAME='studio_analysis_credit_allocations' AND (to_jsonb(OLD)->>'charged_credits' IS NOT NULL OR to_jsonb(OLD)->>'released_at' IS NOT NULL) AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Studio analysis identity and settlement are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_analysis_run_identity ON studio_media_analysis_runs;
CREATE TRIGGER studio_analysis_run_identity BEFORE UPDATE OR DELETE ON studio_media_analysis_runs FOR EACH ROW EXECUTE FUNCTION enforce_studio_analysis_identity();
DROP TRIGGER IF EXISTS studio_analysis_funding_identity ON studio_analysis_credit_funding;
CREATE TRIGGER studio_analysis_funding_identity BEFORE UPDATE OR DELETE ON studio_analysis_credit_funding FOR EACH ROW EXECUTE FUNCTION enforce_studio_analysis_identity();
DROP TRIGGER IF EXISTS studio_analysis_allocation_identity ON studio_analysis_credit_allocations;
CREATE TRIGGER studio_analysis_allocation_identity BEFORE UPDATE OR DELETE ON studio_analysis_credit_allocations FOR EACH ROW EXECUTE FUNCTION enforce_studio_analysis_identity();
CREATE OR REPLACE FUNCTION enforce_studio_analysis_allocation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM studio_assistance_credit_lots l JOIN studio_media_analysis_runs r ON r.user_id=l.user_id
    JOIN studio_analysis_credit_funding f ON f.call_id=r.id WHERE l.id=NEW.lot_id AND r.id=NEW.call_id
    AND NEW.reserved_credits+COALESCE((SELECT sum(reserved_credits) FROM studio_analysis_credit_allocations WHERE call_id=NEW.call_id),0)<=f.quoted_cents::bigint*10) THEN
    RAISE EXCEPTION 'Studio analysis allocation exceeds its owned reservation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_analysis_allocation_scope ON studio_analysis_credit_allocations;
CREATE TRIGGER studio_analysis_allocation_scope BEFORE INSERT ON studio_analysis_credit_allocations FOR EACH ROW EXECUTE FUNCTION enforce_studio_analysis_allocation_scope();
