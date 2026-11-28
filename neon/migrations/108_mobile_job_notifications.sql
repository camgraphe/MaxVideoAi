-- One voluntary delivery per account/job. The device token is removed after a ticket is accepted.
CREATE TABLE IF NOT EXISTS mobile_job_notifications (
  user_id text NOT NULL,
  job_id text NOT NULL,
  token text,
  locale text NOT NULL CHECK (locale IN ('fr','en','es')),
  ticket text,
  state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting','receipt','closed')),
  next_check timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 days',
  lease uuid,
  lease_until timestamptz,
  failures integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS mobile_job_notifications_pending ON mobile_job_notifications(next_check)
WHERE state <> 'closed';
CREATE INDEX IF NOT EXISTS mobile_job_notifications_expiry ON mobile_job_notifications(expires_at);
