-- Explicit migration only. No request-time schema bootstrap, Studio project or new credit pool.
CREATE TABLE IF NOT EXISTS prompt_assistance_sessions (
  user_id text NOT NULL, id uuid NOT NULL, scope text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
  PRIMARY KEY(user_id,id)
);
CREATE TABLE IF NOT EXISTS prompt_assistance_requests (
  user_id text NOT NULL, session_id uuid NOT NULL, request_id uuid NOT NULL,
  input_hash text NOT NULL, input_json jsonb NOT NULL,
  lease_id uuid NOT NULL, lease_expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '3 minutes',
  state text NOT NULL CHECK(state IN ('preparing','calling','reported','complete','failed','unknown')),
  model text NOT NULL CHECK(model IN ('gpt-6.1-sol','gpt-6-luna')),
  context_json jsonb, response_json jsonb, reply_json jsonb, error text,
  call_id uuid REFERENCES studio_assistance_calls(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,session_id,request_id),
  FOREIGN KEY(user_id,session_id) REFERENCES prompt_assistance_sessions(user_id,id)
);
CREATE INDEX IF NOT EXISTS prompt_assistance_account_pending ON prompt_assistance_requests(user_id,state);
-- Recovery may arrive before an interrupted POST. Its identity must stay closed even if that POST arrives later.
CREATE TABLE IF NOT EXISTS prompt_assistance_abandoned_requests (
  user_id text NOT NULL, session_id uuid NOT NULL, request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,session_id,request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS prompt_assistance_call ON prompt_assistance_requests(call_id) WHERE call_id IS NOT NULL;
CREATE OR REPLACE FUNCTION enforce_prompt_assistance_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.user_id,NEW.session_id,NEW.request_id,NEW.input_hash,NEW.input_json,NEW.model,NEW.created_at)
    IS DISTINCT FROM (OLD.user_id,OLD.session_id,OLD.request_id,OLD.input_hash,OLD.input_json,OLD.model,OLD.created_at)
    OR (OLD.call_id IS NOT NULL AND NEW.call_id IS DISTINCT FROM OLD.call_id)
    OR (OLD.response_json IS NOT NULL AND NEW.response_json IS DISTINCT FROM OLD.response_json) THEN
    RAISE EXCEPTION 'Prompt assistance request identity and evidence are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prompt_assistance_identity ON prompt_assistance_requests;
CREATE TRIGGER prompt_assistance_identity BEFORE UPDATE ON prompt_assistance_requests FOR EACH ROW EXECUTE FUNCTION enforce_prompt_assistance_identity();
