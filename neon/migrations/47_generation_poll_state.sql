-- Shared across browser requests and cron recovery; contains no user content.
CREATE TABLE IF NOT EXISTS generation_poll_state (
  job_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  lease_until TIMESTAMPTZ NOT NULL,
  checked_at TIMESTAMPTZ
);
