-- After 90. Only additional internal review copies expire; operational history
-- and financial evidence retain their existing ownership and lifecycle.
CREATE OR REPLACE FUNCTION enforce_composer_review_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Review creation time is immutable';
    END IF;
    IF OLD.context_json ? 'reviewInput' AND
       NEW.context_json->'reviewInput' IS DISTINCT FROM OLD.context_json->'reviewInput' THEN
      IF OLD.created_at <= clock_timestamp() - interval '2160 hours'
         AND NEW.context_json = OLD.context_json - 'reviewInput'
         AND to_jsonb(NEW) - 'context_json' = to_jsonb(OLD) - 'context_json' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Recorded review context is immutable';
    END IF;
  END IF;
  IF NEW.created_at <= clock_timestamp() - interval '2160 hours'
     AND NEW.context_json ? 'reviewInput'
     AND (TG_OP = 'INSERT' OR NOT (OLD.context_json ? 'reviewInput') OR OLD.context_json IS NULL) THEN
    RAISE EXCEPTION 'Expired review context cannot be recorded again';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS composer_review_context_immutable ON prompt_assistance_requests;
CREATE TRIGGER composer_review_context_immutable BEFORE INSERT OR UPDATE ON prompt_assistance_requests
FOR EACH ROW EXECUTE FUNCTION enforce_composer_review_context();

CREATE OR REPLACE FUNCTION enforce_studio_review_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Review creation time is immutable';
    END IF;
    IF OLD.review_context_json IS NOT NULL AND NEW.review_context_json IS DISTINCT FROM OLD.review_context_json THEN
      IF OLD.created_at <= clock_timestamp() - interval '2160 hours'
         AND NEW.review_context_json IS NULL
         AND to_jsonb(NEW) - 'review_context_json' = to_jsonb(OLD) - 'review_context_json' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Recorded review context is immutable';
    END IF;
  END IF;
  IF NEW.created_at <= clock_timestamp() - interval '2160 hours'
     AND NEW.review_context_json IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.review_context_json IS NULL) THEN
    RAISE EXCEPTION 'Expired review context cannot be recorded again';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS studio_review_context_immutable ON studio_conversation_responses;
CREATE TRIGGER studio_review_context_immutable BEFORE INSERT OR UPDATE ON studio_conversation_responses
FOR EACH ROW EXECUTE FUNCTION enforce_studio_review_context();

CREATE OR REPLACE FUNCTION enforce_assistant_review_note() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.note <> '' AND NEW.created_at <= clock_timestamp() - interval '2160 hours' THEN
      RAISE EXCEPTION 'Expired review notes cannot be recorded again';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.created_at <= clock_timestamp() - interval '2160 hours'
     AND OLD.note <> '' AND NEW.note = ''
     AND to_jsonb(NEW) - 'note' = to_jsonb(OLD) - 'note' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Review annotation history is append-only';
END; $$;
DROP TRIGGER IF EXISTS assistant_review_annotation_immutable ON admin_assistant_review_annotations;
CREATE TRIGGER assistant_review_annotation_immutable BEFORE INSERT OR UPDATE ON admin_assistant_review_annotations
FOR EACH ROW EXECUTE FUNCTION enforce_assistant_review_note();
-- The access audit trigger stays append-only with no cleanup exception.
CREATE INDEX IF NOT EXISTS composer_review_retention ON prompt_assistance_requests(created_at,user_id,session_id,request_id) WHERE context_json ? 'reviewInput';
CREATE INDEX IF NOT EXISTS studio_review_retention ON studio_conversation_responses(created_at,user_id,project_id,request_id,lease_id,response_index) WHERE review_context_json IS NOT NULL;
CREATE INDEX IF NOT EXISTS assistant_review_note_retention ON admin_assistant_review_annotations(created_at,id) WHERE note <> '';
COMMENT ON COLUMN studio_conversation_responses.review_context_json IS 'Additional redacted internal review input snapshot. Removed after 90 elapsed days by scheduled cleanup; original history and provider evidence are separate.';
COMMENT ON TABLE admin_assistant_review_annotations IS 'Restricted human review. Free-text notes expire after 90 elapsed days; verdicts, issue labels and access audits remain under their existing lifecycle.';
