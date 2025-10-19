CREATE TABLE IF NOT EXISTS email_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  recipient TEXT,
  provider_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at DESC);
CREATE INDEX IF NOT EXISTS email_events_recipient_idx ON email_events (recipient);
