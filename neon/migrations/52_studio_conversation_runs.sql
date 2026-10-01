-- Explicit migration after 49-51. Enable STUDIO_CONVERSATION_ACTIONS_ENABLED only after deployment.
-- Project memory is an editable summary; runs preserve immutable tool identity and results.
CREATE TABLE IF NOT EXISTS studio_conversation_memory (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
  brief TEXT NOT NULL CHECK (length(brief) <= 3000),
  decisions JSONB NOT NULL CHECK (jsonb_typeof(decisions) = 'array' AND jsonb_array_length(decisions) <= 12),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, project_id)
);
CREATE TABLE IF NOT EXISTS studio_conversation_steps (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  request_id UUID NOT NULL,
  call_id TEXT NOT NULL CHECK (length(call_id) BETWEEN 1 AND 200),
  lease_id UUID NOT NULL,
  action_hash TEXT NOT NULL CHECK (action_hash ~ '^[a-f0-9]{64}$'),
  action_json JSONB NOT NULL CHECK (jsonb_typeof(action_json) = 'object'),
  observed_revision BIGINT NOT NULL CHECK (observed_revision >= 0),
  state TEXT NOT NULL DEFAULT 'started' CHECK (state IN ('started','completed')),
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, project_id, request_id, call_id),
  FOREIGN KEY (user_id, project_id, request_id) REFERENCES studio_image_turns(user_id, project_id, request_id) ON DELETE CASCADE,
  CHECK ((state = 'completed') = (result_json IS NOT NULL)),
  CHECK (result_json IS NULL OR jsonb_typeof(result_json) = 'object')
);
CREATE TABLE IF NOT EXISTS studio_conversation_responses (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  request_id UUID NOT NULL,
  lease_id UUID NOT NULL,
  response_index SMALLINT NOT NULL CHECK (response_index BETWEEN 0 AND 3),
  state TEXT NOT NULL DEFAULT 'started' CHECK (state IN ('started','reported','unknown')),
  response_id TEXT UNIQUE,
  response_json JSONB,
  elapsed_ms INTEGER CHECK (elapsed_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, project_id, request_id, lease_id, response_index),
  FOREIGN KEY (user_id, project_id, request_id) REFERENCES studio_image_turns(user_id, project_id, request_id) ON DELETE CASCADE,
  CHECK ((state = 'reported') = (response_id IS NOT NULL AND response_json IS NOT NULL)),
  CHECK (response_json IS NULL OR jsonb_typeof(response_json) = 'object')
);
CREATE INDEX IF NOT EXISTS studio_conversation_responses_project ON studio_conversation_responses(user_id,project_id,created_at);
CREATE OR REPLACE FUNCTION enforce_studio_conversation_step_identity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.call_id IS DISTINCT FROM OLD.call_id
    OR NEW.lease_id IS DISTINCT FROM OLD.lease_id OR NEW.action_hash IS DISTINCT FROM OLD.action_hash
    OR NEW.action_json IS DISTINCT FROM OLD.action_json OR NEW.observed_revision IS DISTINCT FROM OLD.observed_revision
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.result_json IS NOT NULL AND (NEW.result_json IS DISTINCT FROM OLD.result_json OR NEW.state IS DISTINCT FROM OLD.state)) THEN
    RAISE EXCEPTION 'Studio action identity and completed result are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_conversation_step_identity ON studio_conversation_steps;
CREATE TRIGGER studio_conversation_step_identity BEFORE UPDATE ON studio_conversation_steps
FOR EACH ROW EXECUTE FUNCTION enforce_studio_conversation_step_identity();
