BEGIN;

ALTER TABLE app_pricing_rules
  ADD COLUMN IF NOT EXISTS mode TEXT,
  ADD COLUMN IF NOT EXISTS compatibility_profile TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE TABLE IF NOT EXISTS app_pricing_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL CHECK (domain IN ('policy_rule', 'membership', 'billing_product')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'rollback')),
  target_id TEXT NOT NULL,
  actor_id UUID NOT NULL,
  previous_state JSONB,
  next_state JSONB,
  preview_summary JSONB NOT NULL,
  affected_scenario_ids JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_pricing_change_events_target_created_idx
  ON app_pricing_change_events (domain, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_pricing_change_events_actor_created_idx
  ON app_pricing_change_events (actor_id, created_at DESC);

COMMIT;
