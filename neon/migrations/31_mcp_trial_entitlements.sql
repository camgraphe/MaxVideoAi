DO $$
BEGIN
  IF to_regclass('public.mcp_generation_quotes') IS NULL THEN
    RAISE EXCEPTION 'Migration 31 requires migration 30 mcp_generation_quotes prerequisite';
  END IF;
END;
$$;

ALTER TABLE mcp_generation_quotes
  DROP CONSTRAINT IF EXISTS mcp_generation_quotes_funding_wallet;
ALTER TABLE mcp_generation_quotes
  DROP CONSTRAINT IF EXISTS mcp_generation_quotes_funding_allowlist;
ALTER TABLE mcp_generation_quotes
  DROP CONSTRAINT IF EXISTS mcp_generation_quotes_funding_shape;

ALTER TABLE mcp_generation_quotes
  ADD CONSTRAINT mcp_generation_quotes_funding_allowlist CHECK (
    (funding_mode IN ('wallet', 'trial')) IS TRUE
  ),
  ADD CONSTRAINT mcp_generation_quotes_funding_shape CHECK (
    (
      (
        funding_mode = 'wallet'
        AND price_cents >= 0
        AND NOT (pricing_snapshot ? 'funding')
      )
      OR (
        funding_mode = 'trial'
        AND price_cents = 0
        AND jsonb_typeof(pricing_snapshot -> 'funding') = 'object'
        AND (pricing_snapshot -> 'funding') ?& ARRAY[
          'kind', 'customerChargeCents', 'normalPriceCents', 'providerCostCents'
        ]::text[]
        AND (pricing_snapshot -> 'funding') - ARRAY[
          'kind', 'customerChargeCents', 'normalPriceCents', 'providerCostCents'
        ]::text[] = '{}'::jsonb
        AND pricing_snapshot #>> '{funding,kind}' = 'included_trial'
        AND jsonb_typeof(pricing_snapshot #> '{funding,customerChargeCents}') = 'number'
        AND pricing_snapshot #> '{funding,customerChargeCents}' = '0'::jsonb
        AND jsonb_typeof(pricing_snapshot #> '{funding,normalPriceCents}') = 'number'
        AND (pricing_snapshot #>> '{funding,normalPriceCents}') ~ '^[1-9][0-9]*$'
        AND (pricing_snapshot #>> '{funding,normalPriceCents}')::numeric <= 9007199254740991
        AND jsonb_typeof(pricing_snapshot #> '{funding,providerCostCents}') = 'number'
        AND (pricing_snapshot #>> '{funding,providerCostCents}') ~ '^[1-9][0-9]*$'
        AND (pricing_snapshot #>> '{funding,providerCostCents}')::numeric <= 9007199254740991
        AND pricing_snapshot #> '{canonicalPricing,totalCents}'
          = pricing_snapshot #> '{funding,normalPriceCents}'
        AND pricing_snapshot #>> '{canonicalPricing,currency}' = currency
        AND pricing_snapshot #> '{canonicalPricing,base,amountCents}'
          = pricing_snapshot #> '{funding,providerCostCents}'
      )
    ) IS TRUE
  );

CREATE TABLE IF NOT EXISTS mcp_trial_quote_prepared_audit (
  quote_id UUID PRIMARY KEY REFERENCES mcp_generation_quotes(quote_id),
  event_type TEXT NOT NULL DEFAULT 'trial_quote_prepared',
  engine_id TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  audio BOOLEAN NOT NULL,
  oauth_client_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT mcp_trial_quote_audit_event CHECK (
    (event_type = 'trial_quote_prepared') IS TRUE
  ),
  CONSTRAINT mcp_trial_quote_audit_engine CHECK (
    (engine_id = 'seedance-2-0-mini') IS TRUE
  ),
  CONSTRAINT mcp_trial_quote_audit_ratio CHECK (
    (aspect_ratio IN ('16:9', '9:16', '1:1')) IS TRUE
  ),
  CONSTRAINT mcp_trial_quote_audit_client CHECK (
    (
      length(oauth_client_id) BETWEEN 1 AND 256
      AND oauth_client_id = btrim(oauth_client_id)
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_quote_audit_outcome CHECK (
    (outcome = 'success') IS TRUE
  )
);

CREATE OR REPLACE FUNCTION enforce_mcp_trial_quote_prepared_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  quoted public.mcp_generation_quotes%ROWTYPE;
BEGIN
  SELECT * INTO quoted
    FROM public.mcp_generation_quotes
   WHERE quote_id = NEW.quote_id;
  IF NOT FOUND
    OR quoted.funding_mode <> 'trial'
    OR NEW.event_type <> 'trial_quote_prepared'
    OR NEW.outcome <> 'success'
    OR quoted.oauth_client_id IS DISTINCT FROM NEW.oauth_client_id
    OR quoted.request_json ->> 'engineId' IS DISTINCT FROM NEW.engine_id
    OR quoted.request_json #>> '{settings,aspectRatio}' IS DISTINCT FROM NEW.aspect_ratio
    OR quoted.request_json #>> '{settings,audio}' IS DISTINCT FROM NEW.audio::text
  THEN
    RAISE EXCEPTION 'Invalid MCP trial quote prepared audit attribution';
  END IF;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_trial_quote_prepared_audit_enforce_insert
  ON mcp_trial_quote_prepared_audit;
CREATE TRIGGER mcp_trial_quote_prepared_audit_enforce_insert
  BEFORE INSERT ON mcp_trial_quote_prepared_audit
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_trial_quote_prepared_audit_insert();

CREATE OR REPLACE FUNCTION enforce_mcp_trial_quote_prepared_audit_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'MCP trial quote prepared audit rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS mcp_trial_quote_prepared_audit_immutable
  ON mcp_trial_quote_prepared_audit;
CREATE TRIGGER mcp_trial_quote_prepared_audit_immutable
  BEFORE UPDATE OR DELETE ON mcp_trial_quote_prepared_audit
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_trial_quote_prepared_audit_immutability();

CREATE TABLE IF NOT EXISTS mcp_trial_entitlements (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'available',
  reserved_quote_id UUID UNIQUE REFERENCES mcp_generation_quotes(quote_id),
  job_id TEXT UNIQUE,
  reserved_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  last_reason_code TEXT,

  CONSTRAINT mcp_trial_entitlements_user_format CHECK (
    (
      length(user_id) BETWEEN 1 AND 128
      AND user_id = btrim(user_id)
      AND user_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@|+-]*$'
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_entitlements_status_allowlist CHECK (
    (status IN ('available', 'reserved', 'consumed', 'released')) IS TRUE
  ),
  CONSTRAINT mcp_trial_entitlements_job_format CHECK (
    (
      job_id IS NULL
      OR (
        length(job_id) BETWEEN 1 AND 256
        AND job_id = btrim(job_id)
        AND job_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@|+-]*$'
      )
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_entitlements_reason_format CHECK (
    (
      last_reason_code IS NULL
      OR (
        length(last_reason_code) BETWEEN 1 AND 64
        AND last_reason_code ~ '^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$'
      )
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_entitlements_time_order CHECK (
    (
      updated_at >= created_at
      AND (reserved_at IS NULL OR (reserved_at >= created_at AND reserved_at <= updated_at))
      AND (consumed_at IS NULL OR (consumed_at >= reserved_at AND consumed_at <= updated_at))
      AND (released_at IS NULL OR (released_at >= reserved_at AND released_at <= updated_at))
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_entitlements_state_shape CHECK (
    (
      CASE status
        WHEN 'available' THEN
          reserved_quote_id IS NULL AND job_id IS NULL
          AND reserved_at IS NULL AND consumed_at IS NULL AND released_at IS NULL
        WHEN 'reserved' THEN
          reserved_quote_id IS NOT NULL AND job_id IS NOT NULL
          AND reserved_at IS NOT NULL AND consumed_at IS NULL AND released_at IS NULL
        WHEN 'consumed' THEN
          reserved_quote_id IS NOT NULL AND job_id IS NOT NULL
          AND reserved_at IS NOT NULL AND consumed_at IS NOT NULL AND released_at IS NULL
        WHEN 'released' THEN
          reserved_quote_id IS NOT NULL AND job_id IS NOT NULL
          AND reserved_at IS NOT NULL AND consumed_at IS NULL AND released_at IS NOT NULL
        ELSE FALSE
      END
    ) IS TRUE
  )
);

CREATE INDEX IF NOT EXISTS mcp_trial_entitlements_status_updated_idx
  ON mcp_trial_entitlements (status, updated_at);
CREATE INDEX IF NOT EXISTS mcp_trial_entitlements_reserved_at_idx
  ON mcp_trial_entitlements (reserved_at)
  WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS mcp_trial_entitlements_consumed_at_idx
  ON mcp_trial_entitlements (consumed_at)
  WHERE status = 'consumed';
CREATE INDEX IF NOT EXISTS mcp_trial_entitlements_released_at_idx
  ON mcp_trial_entitlements (released_at)
  WHERE status = 'released';

CREATE OR REPLACE FUNCTION enforce_mcp_trial_entitlement_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'available'
    OR NEW.reserved_quote_id IS NOT NULL
    OR NEW.job_id IS NOT NULL
    OR NEW.reserved_at IS NOT NULL
    OR NEW.consumed_at IS NOT NULL
    OR NEW.released_at IS NOT NULL
    OR NEW.last_reason_code IS NOT NULL
  THEN
    RAISE EXCEPTION 'New MCP trial entitlements must start available';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_trial_entitlements_enforce_insert ON mcp_trial_entitlements;
CREATE TRIGGER mcp_trial_entitlements_enforce_insert
  BEFORE INSERT ON mcp_trial_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_trial_entitlement_insert();

CREATE OR REPLACE FUNCTION enforce_mcp_trial_entitlement_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'MCP trial entitlement identity and creation time are immutable';
  END IF;

  IF NEW.status = OLD.status THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Same-state MCP trial entitlement updates must be exact no-ops';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'MCP trial entitlement updated_at cannot move backwards';
  END IF;

  IF OLD.status IN ('available', 'released') AND NEW.status = 'reserved' THEN
    IF NEW.reserved_quote_id IS NULL
      OR NEW.job_id IS NULL
      OR NEW.reserved_at IS NULL
      OR NEW.consumed_at IS NOT NULL
      OR NEW.released_at IS NOT NULL
      OR (OLD.status = 'released' AND (
        NEW.reserved_quote_id IS NOT DISTINCT FROM OLD.reserved_quote_id
        OR NEW.job_id IS NOT DISTINCT FROM OLD.job_id
        OR NEW.reserved_at IS NOT DISTINCT FROM OLD.reserved_at
      ))
    THEN
      RAISE EXCEPTION 'Invalid MCP trial reservation transition';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'reserved' AND NEW.status IN ('consumed', 'released') THEN
    IF NEW.reserved_quote_id IS DISTINCT FROM OLD.reserved_quote_id
      OR NEW.job_id IS DISTINCT FROM OLD.job_id
      OR NEW.reserved_at IS DISTINCT FROM OLD.reserved_at
      OR (NEW.status = 'consumed' AND (
        NEW.consumed_at IS NULL OR NEW.released_at IS NOT NULL
      ))
      OR (NEW.status = 'released' AND (
        NEW.released_at IS NULL OR NEW.consumed_at IS NOT NULL
      ))
    THEN
      RAISE EXCEPTION 'Invalid MCP trial terminal transition';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid MCP trial entitlement transition from % to %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS mcp_trial_entitlements_enforce_update ON mcp_trial_entitlements;
CREATE TRIGGER mcp_trial_entitlements_enforce_update
  BEFORE UPDATE ON mcp_trial_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_trial_entitlement_update();

CREATE TABLE IF NOT EXISTS mcp_trial_risk_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  oauth_client_id TEXT,
  risk_fingerprint_hash TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  provider_cost_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT mcp_trial_risk_events_user_format CHECK (
    (length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id)) IS TRUE
  ),
  CONSTRAINT mcp_trial_risk_events_oauth_client_format CHECK (
    (
      oauth_client_id IS NULL
      OR (length(oauth_client_id) BETWEEN 1 AND 256 AND oauth_client_id = btrim(oauth_client_id))
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_risk_events_fingerprint_format CHECK (
    (risk_fingerprint_hash ~ '^[a-f0-9]{64}$') IS TRUE
  ),
  CONSTRAINT mcp_trial_risk_events_outcome_allowlist CHECK (
    (outcome IN ('allowed', 'blocked', 'rate_limited', 'error')) IS TRUE
  ),
  CONSTRAINT mcp_trial_risk_events_reason_format CHECK (
    (
      length(reason_code) BETWEEN 1 AND 64
      AND reason_code IN (
        'accepted',
        'user_daily_limit',
        'oauth_client_daily_limit',
        'fingerprint_daily_limit',
        'global_daily_cost_cap'
      )
    ) IS TRUE
  ),
  CONSTRAINT mcp_trial_risk_events_provider_cost_range CHECK (
    (provider_cost_cents BETWEEN 0 AND 9007199254740991) IS TRUE
  ),
  CONSTRAINT mcp_trial_risk_events_decision_shape CHECK (
    (
      (
        outcome = 'allowed'
        AND reason_code = 'accepted'
        AND provider_cost_cents > 0
      )
      OR (
        outcome = 'blocked'
        AND reason_code = 'user_daily_limit'
        AND provider_cost_cents = 0
      )
      OR (
        outcome = 'rate_limited'
        AND reason_code IN (
          'oauth_client_daily_limit',
          'fingerprint_daily_limit',
          'global_daily_cost_cap'
        )
        AND provider_cost_cents = 0
      )
      OR (outcome = 'error' AND provider_cost_cents = 0)
    ) IS TRUE
  )
);

CREATE OR REPLACE FUNCTION enforce_mcp_trial_risk_event_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_RELID IS DISTINCT FROM 'public.mcp_trial_risk_events'::pg_catalog.regclass THEN
    RAISE EXCEPTION 'MCP trial risk event insert trigger rejected an unrelated table';
  END IF;

  NEW.id := pg_catalog.nextval(
    pg_catalog.pg_get_serial_sequence(
      'public.mcp_trial_risk_events',
      'id'
    )::pg_catalog.regclass
  );
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION enforce_mcp_trial_risk_event_insert()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS mcp_trial_risk_events_enforce_insert ON mcp_trial_risk_events;
CREATE TRIGGER mcp_trial_risk_events_enforce_insert
  BEFORE INSERT ON mcp_trial_risk_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_trial_risk_event_insert();

CREATE INDEX IF NOT EXISTS mcp_trial_risk_events_user_window_idx
  ON mcp_trial_risk_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_trial_risk_events_client_window_idx
  ON mcp_trial_risk_events (oauth_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_trial_risk_events_fingerprint_window_idx
  ON mcp_trial_risk_events (risk_fingerprint_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_trial_risk_events_cleanup_idx
  ON mcp_trial_risk_events (created_at, id);

CREATE OR REPLACE FUNCTION enforce_mcp_trial_risk_event_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  cleanup_owner NAME;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'MCP trial risk events are immutable';
  END IF;

  SELECT pg_catalog.pg_get_userbyid(cleanup_function.proowner)
    INTO cleanup_owner
    FROM pg_catalog.pg_proc AS cleanup_function
   WHERE cleanup_function.oid =
     'public.cleanup_mcp_trial_risk_events(timestamp with time zone,integer)'::pg_catalog.regprocedure;

  IF cleanup_owner IS NULL OR current_user <> cleanup_owner THEN
    RAISE EXCEPTION 'MCP trial risk events may only be deleted by the cleanup function owner';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS mcp_trial_risk_events_immutable ON mcp_trial_risk_events;
CREATE TRIGGER mcp_trial_risk_events_immutable
  BEFORE UPDATE OR DELETE ON mcp_trial_risk_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_trial_risk_event_immutability();

CREATE OR REPLACE FUNCTION cleanup_mcp_trial_risk_events(
  p_cutoff TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  IF p_cutoff IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'Invalid MCP trial risk cleanup boundary';
  END IF;

  WITH cleanup_batch AS (
    SELECT id
      FROM public.mcp_trial_risk_events
     WHERE created_at < p_cutoff
     ORDER BY created_at, id
     LIMIT p_limit
  )
  DELETE FROM public.mcp_trial_risk_events AS event
   USING cleanup_batch
   WHERE event.id = cleanup_batch.id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL PRIVILEGES ON FUNCTION cleanup_mcp_trial_risk_events(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC;

-- The runtime role must not own the table or function security boundaries.
-- Runtime INSERT may use the identity sequence but must not receive direct EXECUTE on the insert trigger.
-- Deployment must GRANT EXECUTE on cleanup explicitly to the approved maintenance role.
