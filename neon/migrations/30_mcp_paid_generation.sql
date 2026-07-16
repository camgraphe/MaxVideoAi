CREATE TABLE IF NOT EXISTS mcp_generation_quotes (
  quote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  oauth_client_id TEXT,
  request_json JSONB NOT NULL,
  request_hash TEXT NOT NULL,
  catalog_revision TEXT NOT NULL,
  pricing_snapshot JSONB NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  funding_mode TEXT NOT NULL,
  state TEXT NOT NULL,
  job_id TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mcp_generation_quotes_user_format CHECK (
    (length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id)) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_oauth_client_format CHECK (
    (
      oauth_client_id IS NULL
      OR (length(oauth_client_id) BETWEEN 1 AND 256 AND oauth_client_id = btrim(oauth_client_id))
    ) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_request_object CHECK (
    (
      jsonb_typeof(request_json) = 'object'
      AND jsonb_typeof(request_json -> 'schemaVersion') = 'number'
      AND request_json -> 'schemaVersion' = '1'::jsonb
    ) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_request_hash_format CHECK (
    (request_hash ~ '^[a-f0-9]{64}$') IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_catalog_revision_format CHECK (
    (
      length(catalog_revision) BETWEEN 1 AND 256
      AND catalog_revision = btrim(catalog_revision)
    ) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_pricing_object CHECK (
    (jsonb_typeof(pricing_snapshot) = 'object') IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_price_nonnegative CHECK ((price_cents >= 0) IS TRUE),
  CONSTRAINT mcp_generation_quotes_currency_format CHECK ((currency ~ '^[A-Z]{3}$') IS TRUE),
  CONSTRAINT mcp_generation_quotes_funding_wallet CHECK ((funding_mode = 'wallet') IS TRUE),
  CONSTRAINT mcp_generation_quotes_state_allowlist CHECK (
    (state IN ('prepared', 'claimed', 'accepted', 'failed', 'expired')) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_job_format CHECK (
    (
      job_id IS NULL
      OR (length(job_id) BETWEEN 1 AND 256 AND job_id = btrim(job_id))
    ) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_lifetime CHECK (
    (expires_at = created_at + INTERVAL '10 minutes') IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_time_order CHECK (
    (
      updated_at >= created_at
      AND (
        claimed_at IS NULL
        OR (claimed_at >= created_at AND claimed_at < expires_at AND claimed_at <= updated_at)
      )
    ) IS TRUE
  ),
  CONSTRAINT mcp_generation_quotes_state_shape CHECK (
    (
      CASE state
        WHEN 'prepared' THEN job_id IS NULL AND claimed_at IS NULL
        WHEN 'claimed' THEN job_id IS NOT NULL AND claimed_at IS NOT NULL
        WHEN 'accepted' THEN job_id IS NOT NULL AND claimed_at IS NOT NULL
        WHEN 'expired' THEN job_id IS NULL AND claimed_at IS NULL
        WHEN 'failed' THEN (job_id IS NULL) = (claimed_at IS NULL)
        ELSE FALSE
      END
    ) IS TRUE
  )
);

COMMENT ON COLUMN mcp_generation_quotes.request_json IS
  'Private canonical generation request. Never project into analytics, logs, or public tool output.';
COMMENT ON COLUMN mcp_generation_quotes.pricing_snapshot IS
  'Private immutable server pricing snapshot used to revalidate a quoted generation.';

CREATE TABLE IF NOT EXISTS mcp_spending_limits (
  user_id TEXT PRIMARY KEY,
  paid_generation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  per_generation_cents INTEGER,
  daily_cents INTEGER,
  web_approval_above_cents INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mcp_spending_limits_user_format CHECK (
    (length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id)) IS TRUE
  ),
  CONSTRAINT mcp_spending_limits_per_generation_nonnegative CHECK (
    (per_generation_cents IS NULL OR per_generation_cents >= 0) IS TRUE
  ),
  CONSTRAINT mcp_spending_limits_daily_nonnegative CHECK (
    (daily_cents IS NULL OR daily_cents >= 0) IS TRUE
  ),
  CONSTRAINT mcp_spending_limits_web_approval_nonnegative CHECK (
    (web_approval_above_cents IS NULL OR web_approval_above_cents >= 0) IS TRUE
  )
);

CREATE INDEX IF NOT EXISTS mcp_generation_quotes_user_created_idx
  ON mcp_generation_quotes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_generation_quotes_oauth_client_created_idx
  ON mcp_generation_quotes (oauth_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_generation_quotes_expiration_idx
  ON mcp_generation_quotes (expires_at)
  WHERE state = 'prepared';
CREATE INDEX IF NOT EXISTS mcp_generation_quotes_state_idx
  ON mcp_generation_quotes (state, created_at DESC);
CREATE INDEX IF NOT EXISTS mcp_generation_quotes_accepted_spend_idx
  ON mcp_generation_quotes (user_id, currency, claimed_at)
  WHERE state IN ('claimed', 'accepted') AND funding_mode = 'wallet';

CREATE OR REPLACE FUNCTION enforce_mcp_generation_quote_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.state <> 'prepared' OR NEW.job_id IS NOT NULL OR NEW.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'New MCP generation quotes must start prepared and unclaimed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_generation_quotes_enforce_insert ON mcp_generation_quotes;
CREATE TRIGGER mcp_generation_quotes_enforce_insert
  BEFORE INSERT ON mcp_generation_quotes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_generation_quote_insert();

CREATE OR REPLACE FUNCTION enforce_mcp_generation_quote_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quote_id IS DISTINCT FROM OLD.quote_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.oauth_client_id IS DISTINCT FROM OLD.oauth_client_id
    OR NEW.request_json IS DISTINCT FROM OLD.request_json
    OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
    OR NEW.catalog_revision IS DISTINCT FROM OLD.catalog_revision
    OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
    OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.funding_mode IS DISTINCT FROM OLD.funding_mode
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'MCP generation quote identity, request, pricing, funding, and lifetime are immutable';
  END IF;

  IF NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'MCP generation quote updated_at cannot move backwards';
  END IF;
  IF (
    NEW.job_id IS DISTINCT FROM OLD.job_id
    OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
  ) AND NOT (
    OLD.state = 'prepared'
    AND NEW.state = 'claimed'
    AND OLD.job_id IS NULL
    AND OLD.claimed_at IS NULL
    AND NEW.job_id IS NOT NULL
    AND NEW.claimed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MCP generation quote job ownership and claimed_at may only be set by the claim transition';
  END IF;

  IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
    (OLD.state = 'prepared' AND NEW.state IN ('claimed', 'failed', 'expired'))
    OR (OLD.state = 'claimed' AND NEW.state IN ('accepted', 'failed'))
    OR (OLD.state = 'accepted' AND NEW.state = 'failed')
  ) THEN
    RAISE EXCEPTION 'Invalid MCP generation quote state transition from % to %', OLD.state, NEW.state;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mcp_generation_quotes_enforce_update ON mcp_generation_quotes;
CREATE TRIGGER mcp_generation_quotes_enforce_update
  BEFORE UPDATE ON mcp_generation_quotes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mcp_generation_quote_update();
