DO $$
BEGIN
  IF to_regclass('public.mcp_generation_quotes') IS NULL
    OR to_regclass('public.mcp_trial_entitlements') IS NULL
    OR to_regclass('public.mcp_reference_upload_sessions') IS NULL
  THEN
    RAISE EXCEPTION
      'Migration 33 is reserved and requires migrations 30, 31, and 32 before it may be applied';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS mcp_funnel_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  oauth_client_id TEXT,
  event_type TEXT NOT NULL,
  stage TEXT,
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  campaign TEXT NOT NULL,
  acquisition_client TEXT NOT NULL,
  acquisition_id TEXT,
  quote_id UUID,
  job_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  idempotency_key TEXT NOT NULL,
  receipt_hash TEXT,

  CONSTRAINT mcp_funnel_events_user_format CHECK (
    user_id IS NULL OR (length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id))
  ),
  CONSTRAINT mcp_funnel_events_oauth_client_format CHECK (
    oauth_client_id IS NULL
    OR (length(oauth_client_id) BETWEEN 1 AND 256 AND oauth_client_id = btrim(oauth_client_id))
  ),
  CONSTRAINT mcp_funnel_events_type_allowlist CHECK (event_type IN (
    'landing_cta_clicked',
    'oauth_connection_started',
    'oauth_connection_completed',
    'oauth_connection_revoked',
    'trial_quote_prepared',
    'trial_generation_accepted',
    'trial_generation_completed',
    'trial_generation_released',
    'trial_generation_blocked',
    'topup_handoff_created',
    'wallet_funded',
    'paid_quote_prepared',
    'paid_generation_accepted',
    'paid_generation_completed',
    'paid_generation_failed',
    'tool_called',
    'tool_failed'
  )),
  CONSTRAINT mcp_funnel_events_stage_allowlist CHECK (
    stage IS NULL OR stage IN (
      'oauth_connected',
      'trial_prepared',
      'trial_completed',
      'wallet_funded',
      'first_paid_generation',
      'repeat_paid_generation'
    )
  ),
  CONSTRAINT mcp_funnel_events_stage_mapping CHECK (
    (
      CASE event_type
        WHEN 'oauth_connection_completed' THEN stage = 'oauth_connected'
        WHEN 'trial_quote_prepared' THEN stage = 'trial_prepared'
        WHEN 'trial_generation_completed' THEN stage = 'trial_completed'
        WHEN 'wallet_funded' THEN stage = 'wallet_funded'
        WHEN 'paid_generation_completed' THEN
          stage IN ('first_paid_generation', 'repeat_paid_generation')
        ELSE stage IS NULL
      END
    ) IS TRUE
  ),
  CONSTRAINT mcp_funnel_events_attribution_allowlist CHECK (
    (
      CASE source
        WHEN 'mcp_landing' THEN
          medium = 'owned'
          AND campaign = 'mcp_connect'
          AND acquisition_client IN ('claude', 'codex')
          AND acquisition_id IS NOT NULL
        WHEN 'direct_mcp' THEN
          medium = 'mcp'
          AND campaign = 'none'
          AND acquisition_client = 'other'
          AND acquisition_id IS NULL
        ELSE FALSE
      END
    ) IS TRUE
  ),
  CONSTRAINT mcp_funnel_events_acquisition_id_format CHECK (
    acquisition_id IS NULL OR acquisition_id ~ '^acq_[A-Za-z0-9_-]{24}$'
  ),
  CONSTRAINT mcp_funnel_events_job_id_format CHECK (
    job_id IS NULL OR (length(job_id) BETWEEN 1 AND 256 AND job_id = btrim(job_id))
  ),
  CONSTRAINT mcp_funnel_events_financial_shape CHECK (
    (
      CASE
        WHEN event_type = 'wallet_funded' THEN
          amount_cents IS NOT NULL
          AND amount_cents > 0
          AND currency IS NOT NULL
          AND currency ~ '^[A-Z]{3}$'
          AND receipt_hash IS NOT NULL
          AND receipt_hash ~ '^[a-f0-9]{64}$'
        WHEN event_type IN ('trial_quote_prepared', 'paid_quote_prepared') THEN
          (
            (amount_cents IS NULL AND currency IS NULL)
            OR (
              amount_cents IS NOT NULL
              AND amount_cents >= 0
              AND currency IS NOT NULL
              AND currency ~ '^[A-Z]{3}$'
            )
          )
          AND receipt_hash IS NULL
        ELSE
          amount_cents IS NULL
          AND currency IS NULL
          AND receipt_hash IS NULL
      END
    ) IS TRUE
  ),
  CONSTRAINT mcp_funnel_events_identity_requirement CHECK (
    (
      CASE event_type
        WHEN 'landing_cta_clicked' THEN acquisition_id IS NOT NULL
        ELSE user_id IS NOT NULL
      END
    ) IS TRUE
  ),
  CONSTRAINT mcp_funnel_events_started_context CHECK (
    (
      CASE event_type
        WHEN 'oauth_connection_started' THEN
          oauth_client_id IS NOT NULL AND source = 'mcp_landing'
        ELSE TRUE
      END
    ) IS TRUE
  ),
  CONSTRAINT mcp_funnel_events_idempotency_format CHECK (
    length(idempotency_key) BETWEEN 1 AND 256
    AND idempotency_key ~ '^[A-Za-z0-9:_-]+$'
  )
);

CREATE TABLE IF NOT EXISTS mcp_oauth_connection_bindings (
  binding_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  user_id TEXT NOT NULL,
  oauth_client_id TEXT NOT NULL,
  acquisition_id TEXT NOT NULL,
  source TEXT NOT NULL,
  medium TEXT NOT NULL,
  campaign TEXT NOT NULL,
  acquisition_client TEXT NOT NULL,

  CONSTRAINT mcp_oauth_connection_bindings_id_format CHECK (
    binding_id ~ '^mcpb_[A-Za-z0-9_-]{24}$'
  ),
  CONSTRAINT mcp_oauth_connection_bindings_user_format CHECK (
    length(user_id) BETWEEN 1 AND 128 AND user_id = btrim(user_id)
  ),
  CONSTRAINT mcp_oauth_connection_bindings_client_format CHECK (
    length(oauth_client_id) BETWEEN 1 AND 256 AND oauth_client_id = btrim(oauth_client_id)
  ),
  CONSTRAINT mcp_oauth_connection_bindings_acquisition_format CHECK (
    acquisition_id ~ '^acq_[A-Za-z0-9_-]{24}$'
  ),
  CONSTRAINT mcp_oauth_connection_bindings_attribution CHECK (
    source = 'mcp_landing'
    AND medium = 'owned'
    AND campaign = 'mcp_connect'
    AND acquisition_client IN ('claude', 'codex')
  ),
  CONSTRAINT mcp_oauth_connection_bindings_time_order CHECK (
    expires_at > created_at
    AND (approved_at IS NULL OR (approved_at >= created_at AND approved_at <= expires_at))
    AND (consumed_at IS NULL OR (approved_at IS NOT NULL AND consumed_at >= approved_at))
  )
);

CREATE INDEX IF NOT EXISTS mcp_funnel_events_occurred_idx
  ON mcp_funnel_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS mcp_funnel_events_user_occurred_idx
  ON mcp_funnel_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS mcp_funnel_events_oauth_client_occurred_idx
  ON mcp_funnel_events (oauth_client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS mcp_funnel_events_acquisition_occurred_idx
  ON mcp_funnel_events (acquisition_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS mcp_funnel_events_quote_occurred_idx
  ON mcp_funnel_events (quote_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS mcp_funnel_events_job_occurred_idx
  ON mcp_funnel_events (job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS mcp_funnel_events_type_occurred_idx
  ON mcp_funnel_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS mcp_oauth_connection_bindings_pending_idx
  ON mcp_oauth_connection_bindings (user_id, oauth_client_id, approved_at, binding_id)
  WHERE approved_at IS NOT NULL AND consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS mcp_oauth_connection_bindings_acquisition_idx
  ON mcp_oauth_connection_bindings (acquisition_id);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_funnel_events_idempotency_unique_idx
  ON mcp_funnel_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mcp_funnel_events_receipt_hash_unique_idx
  ON mcp_funnel_events (receipt_hash)
  WHERE receipt_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_mcp_funnel_event_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'mcp_funnel_events rows are immutable';
END;
$$;

DROP TRIGGER IF EXISTS mcp_funnel_events_reject_update ON mcp_funnel_events;
CREATE TRIGGER mcp_funnel_events_reject_update
  BEFORE UPDATE ON mcp_funnel_events
  FOR EACH ROW
  EXECUTE FUNCTION reject_mcp_funnel_event_update();
