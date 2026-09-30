BEGIN;

CREATE TABLE IF NOT EXISTS app_direct_payment_quotes (
  id TEXT PRIMARY KEY CHECK (length(id) > 0),
  user_id TEXT NOT NULL CHECK (length(user_id) > 0),
  job_id TEXT NOT NULL UNIQUE CHECK (length(job_id) > 0),
  quote_json JSONB NOT NULL CHECK (jsonb_typeof(quote_json) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK (quote_json->>'id' = id AND quote_json->>'userId' = user_id AND quote_json->>'jobId' = job_id)
);
CREATE INDEX IF NOT EXISTS app_direct_payment_quotes_job_idx ON app_direct_payment_quotes (job_id, user_id);

CREATE OR REPLACE FUNCTION reject_direct_payment_quote_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Direct payment quotes are immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS app_direct_payment_quotes_immutable ON app_direct_payment_quotes;
CREATE TRIGGER app_direct_payment_quotes_immutable BEFORE UPDATE OR DELETE ON app_direct_payment_quotes
  FOR EACH ROW EXECUTE FUNCTION reject_direct_payment_quote_mutation();

COMMIT;
