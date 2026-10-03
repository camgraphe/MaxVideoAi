-- Explicit only. No reader/bootstrap applies this migration. Financial evidence does not cascade with project deletion.
CREATE TABLE IF NOT EXISTS studio_assistance_campaigns (
  id text PRIMARY KEY, limit_nano_usd bigint NOT NULL CHECK(limit_nano_usd >= 0)
);
CREATE TABLE IF NOT EXISTS studio_assistance_accounts (
  user_id text PRIMARY KEY,
  selected_model text NOT NULL DEFAULT 'gpt-6.1-sol' CHECK(selected_model IN ('gpt-6.1-sol','gpt-6-luna')),
  paid_enabled boolean NOT NULL DEFAULT false,
  paid_authorized_cents integer NOT NULL DEFAULT 0 CHECK(paid_authorized_cents >= 0),
  tariff_version text,
  sol_limit_nano_usd bigint NOT NULL CHECK(sol_limit_nano_usd >= 0),
  luna_limit_nano_usd bigint NOT NULL CHECK(luna_limit_nano_usd >= 0),
  revision bigint NOT NULL DEFAULT 0 CHECK(revision >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS studio_assistance_turns (
  user_id text NOT NULL REFERENCES studio_assistance_accounts(user_id), project_id text NOT NULL, request_id uuid NOT NULL,
  model text NOT NULL CHECK(model IN ('gpt-6.1-sol','gpt-6-luna')),
  mode text NOT NULL CHECK(mode IN ('included_sol','paid_sol','sponsored_luna')),
  policy_version text NOT NULL, tariff_version text NOT NULL, tariff_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,project_id,request_id)
);
CREATE TABLE IF NOT EXISTS studio_assistance_calls (
  id uuid PRIMARY KEY, user_id text NOT NULL, project_id text NOT NULL, request_id uuid NOT NULL, lease_id uuid NOT NULL,
  response_index integer NOT NULL CHECK(response_index BETWEEN 0 AND 3),
  model text NOT NULL, mode text NOT NULL CHECK(mode IN ('included_sol','paid_sol','sponsored_luna')),
  policy_version text NOT NULL, rate_version text NOT NULL, tariff_version text NOT NULL,
  campaign_id text REFERENCES studio_assistance_campaigns(id),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','unknown','settled')),
  input_token_bound integer NOT NULL CHECK(input_token_bound BETWEEN 0 AND 272000),
  output_token_bound integer NOT NULL CHECK(output_token_bound BETWEEN 0 AND 2200),
  reserved_nano_usd bigint NOT NULL CHECK(reserved_nano_usd >= 0), reserved_cents integer NOT NULL CHECK(reserved_cents >= 0),
  charge_receipt_id text, response_id text UNIQUE, returned_model text, service_tier text,
  usage_facts jsonb, provider_min_nano_usd bigint, provider_max_nano_usd bigint, tariff_basis_nano_usd bigint,
  charged_cents integer CHECK(charged_cents >= 0), pricing_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), settled_at timestamptz,
  UNIQUE(user_id,project_id,request_id,lease_id,response_index),
  FOREIGN KEY(user_id,project_id,request_id) REFERENCES studio_assistance_turns(user_id,project_id,request_id),
  CHECK ((state='settled') = (charged_cents IS NOT NULL AND provider_max_nano_usd IS NOT NULL AND settled_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS studio_assistance_calls_account ON studio_assistance_calls(user_id,created_at);
CREATE INDEX IF NOT EXISTS studio_assistance_calls_campaign ON studio_assistance_calls(campaign_id) WHERE mode <> 'paid_sol';
CREATE TABLE IF NOT EXISTS studio_assistance_choices (
  id bigserial PRIMARY KEY, user_id text NOT NULL, revision bigint NOT NULL, action text NOT NULL,
  authorized_cents integer NOT NULL, tariff_version text, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,revision)
);
CREATE OR REPLACE FUNCTION enforce_studio_assistance_call_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW) - ARRAY['state','response_id','returned_model','service_tier','usage_facts','provider_min_nano_usd','provider_max_nano_usd','tariff_basis_nano_usd','charged_cents','pricing_snapshot','settled_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['state','response_id','returned_model','service_tier','usage_facts','provider_min_nano_usd','provider_max_nano_usd','tariff_basis_nano_usd','charged_cents','pricing_snapshot','settled_at'])
    OR (OLD.response_id IS NOT NULL AND NEW.response_id IS DISTINCT FROM OLD.response_id)
    OR (OLD.state='settled' AND NEW IS DISTINCT FROM OLD) THEN
   RAISE EXCEPTION 'Studio assistance identity and settlements are immutable';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_assistance_call_identity ON studio_assistance_calls;
CREATE TRIGGER studio_assistance_call_identity BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION enforce_studio_assistance_call_identity();
