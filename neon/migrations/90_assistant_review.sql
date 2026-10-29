-- Explicit operator migration after 52 and 85. Never bootstrap on a read request.
ALTER TABLE studio_conversation_responses ADD COLUMN IF NOT EXISTS review_context_json jsonb;
COMMENT ON COLUMN studio_conversation_responses.review_context_json IS
  'Bounded redacted provider input manifest. Private admin review only. Native turn deletion cascades; no media bytes or hidden reasoning.';
CREATE OR REPLACE FUNCTION enforce_studio_review_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.review_context_json IS NOT NULL AND NEW.review_context_json IS DISTINCT FROM OLD.review_context_json THEN
    RAISE EXCEPTION 'Recorded review context is immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS studio_review_context_immutable ON studio_conversation_responses;
CREATE TRIGGER studio_review_context_immutable BEFORE UPDATE ON studio_conversation_responses
FOR EACH ROW EXECUTE FUNCTION enforce_studio_review_context();

CREATE OR REPLACE FUNCTION enforce_composer_review_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.context_json->'reviewInput' IS NOT NULL AND NEW.context_json->'reviewInput' IS DISTINCT FROM OLD.context_json->'reviewInput' THEN
    RAISE EXCEPTION 'Recorded review context is immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS composer_review_context_immutable ON prompt_assistance_requests;
CREATE TRIGGER composer_review_context_immutable BEFORE UPDATE ON prompt_assistance_requests
FOR EACH ROW EXECUTE FUNCTION enforce_composer_review_context();

CREATE TABLE IF NOT EXISTS admin_assistant_review_access (
  id uuid PRIMARY KEY, actor_id text NOT NULL, source text NOT NULL CHECK(source IN ('composer','studio','mcp')),
  user_id text NOT NULL, scope_id text NOT NULL, request_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('reveal','annotate')), projection_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS admin_assistant_review_access_time ON admin_assistant_review_access(created_at DESC);
CREATE TABLE IF NOT EXISTS admin_assistant_review_annotations (
  id uuid PRIMARY KEY, actor_id text NOT NULL, source text NOT NULL CHECK(source IN ('composer','studio','mcp')),
  user_id text NOT NULL, scope_id text NOT NULL, request_id uuid NOT NULL,
  verdict text NOT NULL CHECK(verdict IN ('unreviewed','useful','needs_work')),
  issues jsonb NOT NULL CHECK(jsonb_typeof(issues)='array'), note text NOT NULL CHECK(length(note)<=2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS admin_assistant_review_annotation_target ON admin_assistant_review_annotations(source,user_id,scope_id,request_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION assistant_review_no_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Review audit and annotation history are append-only'; END; $$;
DROP TRIGGER IF EXISTS assistant_review_annotation_immutable ON admin_assistant_review_annotations;
CREATE TRIGGER assistant_review_annotation_immutable BEFORE UPDATE ON admin_assistant_review_annotations
FOR EACH ROW EXECUTE FUNCTION assistant_review_no_update();
DROP TRIGGER IF EXISTS assistant_review_access_immutable ON admin_assistant_review_access;
CREATE TRIGGER assistant_review_access_immutable BEFORE UPDATE ON admin_assistant_review_access
FOR EACH ROW EXECUTE FUNCTION assistant_review_no_update();
CREATE INDEX IF NOT EXISTS prompt_assistance_review_created ON prompt_assistance_requests(created_at DESC,request_id DESC);
COMMENT ON TABLE admin_assistant_review_annotations IS 'Restricted human review, not customer feedback or a model quality score. Visibility requires a retained source. Operator deletion/retention remains explicit.';
