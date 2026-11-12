-- Measurement-only queue; no changes or backfill to financial/authentication tables.
CREATE TABLE IF NOT EXISTS openai_conversion_outbox (
  event_key text PRIMARY KEY,
  event_name text NOT NULL CHECK (event_name IN ('registration_completed','order_created')),
  user_id text,
  payload jsonb,
  policy_version text NOT NULL,
  occurred_at timestamptz NOT NULL,
  consent_observed_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','accepted','suppressed','dead','expired')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  outcome text,
  http_status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('pending','leased') OR (payload IS NOT NULL AND user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS openai_conversion_outbox_due_idx
  ON openai_conversion_outbox (available_at,occurred_at) WHERE status IN ('pending','leased');
