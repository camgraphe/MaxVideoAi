-- Run explicitly after initialized Studio schema and migration 49.
CREATE TABLE IF NOT EXISTS studio_image_turns (
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  input_json JSONB NOT NULL CHECK (jsonb_typeof(input_json) = 'object'),
  draft_json JSONB,
  draft_reference_fingerprint TEXT CHECK (draft_reference_fingerprint ~ '^[a-f0-9]{64}$'),
  quote_id UUID UNIQUE REFERENCES mcp_generation_quotes(quote_id),
  state TEXT NOT NULL DEFAULT 'thinking' CHECK (state IN ('thinking','ready','failed')),
  model_attempts SMALLINT NOT NULL DEFAULT 1 CHECK (model_attempts BETWEEN 1 AND 2),
  lease_id UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, project_id, request_id),
  CHECK (draft_json IS NULL OR jsonb_typeof(draft_json) = 'object'),
  CHECK ((draft_json IS NULL) = (draft_reference_fingerprint IS NULL)),
  CHECK (quote_id IS NULL OR (state = 'ready' AND draft_json IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS studio_image_turns_account_created ON studio_image_turns (user_id, created_at DESC);
CREATE OR REPLACE FUNCTION enforce_studio_image_turn_identity() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
    OR NEW.input_json IS DISTINCT FROM OLD.input_json OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.quote_id IS NOT NULL AND NEW.quote_id IS DISTINCT FROM OLD.quote_id)
    OR (OLD.draft_json IS NOT NULL AND (NEW.draft_json IS DISTINCT FROM OLD.draft_json OR NEW.draft_reference_fingerprint IS DISTINCT FROM OLD.draft_reference_fingerprint)) THEN
    RAISE EXCEPTION 'Studio image turn identity, intent and attached quote are immutable';
  END IF;
  IF NEW.quote_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM mcp_generation_quotes q WHERE q.quote_id = NEW.quote_id
      AND q.user_id = NEW.user_id AND q.auth_origin = 'studio-session'
      AND q.studio_project_id = NEW.project_id
  ) THEN RAISE EXCEPTION 'Studio turn quote scope mismatch'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_image_turn_identity ON studio_image_turns;
CREATE TRIGGER studio_image_turn_identity BEFORE UPDATE ON studio_image_turns
FOR EACH ROW EXECUTE FUNCTION enforce_studio_image_turn_identity();
