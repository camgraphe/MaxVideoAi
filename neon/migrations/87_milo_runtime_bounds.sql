-- Explicit migration. Runtime policy lives in the immutable turn snapshot; old snapshots stay unchanged.
ALTER TABLE studio_assistance_calls DROP CONSTRAINT studio_assistance_calls_output_token_bound_check;
ALTER TABLE studio_assistance_calls ADD CONSTRAINT studio_assistance_calls_output_token_bound_check CHECK(output_token_bound BETWEEN 0 AND 6000);
DO $$ BEGIN
  IF to_regclass('prompt_assistance_requests') IS NOT NULL THEN
    ALTER TABLE prompt_assistance_requests DROP CONSTRAINT prompt_assistance_requests_model_check;
    ALTER TABLE prompt_assistance_requests ADD CONSTRAINT prompt_assistance_requests_model_check CHECK(model IN ('gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION enforce_studio_milo_turn_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Assistance turn identity and runtime policy are immutable'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_milo_turn_identity ON studio_assistance_turns;
CREATE TRIGGER studio_milo_turn_identity BEFORE UPDATE ON studio_assistance_turns FOR EACH ROW EXECUTE FUNCTION enforce_studio_milo_turn_identity();

CREATE OR REPLACE FUNCTION enforce_studio_task_call_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE task record; segment_limit integer; has_task boolean:=false; frozen jsonb; owned boolean:=false;
BEGIN
  IF to_regclass('studio_tasks') IS NOT NULL THEN
    SELECT t.* INTO task FROM studio_tasks t JOIN studio_task_segments s ON s.user_id=t.user_id AND s.project_id=t.project_id AND s.task_request_id=t.request_id
      WHERE s.user_id=NEW.user_id AND s.project_id=NEW.project_id AND s.request_id=NEW.request_id;
    has_task:=FOUND;
  END IF;
  IF has_task THEN
    SELECT max_calls INTO segment_limit FROM studio_task_segments WHERE user_id=NEW.user_id AND project_id=NEW.project_id AND request_id=NEW.request_id;
    IF task.state<>'running' OR task.worker_id IS DISTINCT FROM NEW.lease_id OR task.segment_request_id<>NEW.request_id OR task.lease_expires_at<=clock_timestamp() OR task.deadline_at<=clock_timestamp()
      OR NEW.response_index>=segment_limit
      OR (TG_TABLE_NAME='studio_assistance_calls' AND ((to_jsonb(NEW)->>'output_token_bound')::int>(task.profile_json->>'maxOutputTokens')::int OR (to_jsonb(NEW)->>'input_token_bound')::int>(task.profile_json->>'maxInputTokens')::int)) THEN
      RAISE EXCEPTION 'Task resource bound or worker lease is invalid';
    END IF;
  ELSE
    IF NEW.response_index>3 THEN RAISE EXCEPTION 'Expanded resource bounds require an owned task policy'; END IF;
    IF TG_TABLE_NAME='studio_assistance_calls' AND (to_jsonb(NEW)->>'output_token_bound')::int>2200 THEN
      SELECT tariff_snapshot->'runtime' INTO frozen FROM studio_assistance_turns
        WHERE user_id=NEW.user_id AND project_id=NEW.project_id AND request_id=NEW.request_id AND model=NEW.model;
      IF frozen->>'version' IS DISTINCT FROM 'milo-levels-2026-10-29-v1'
        OR frozen->>'maxOutputTokens' IS DISTINCT FROM '6000'
        OR frozen->>'reasoning' IS DISTINCT FROM (CASE WHEN NEW.model='gpt-6.1-sol' THEN 'xhigh' ELSE 'high' END) THEN
        RAISE EXCEPTION 'Expanded output requires a frozen Milo runtime policy';
      END IF;
      IF NEW.project_id LIKE 'composer:%' AND to_regclass('prompt_assistance_requests') IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM prompt_assistance_requests r WHERE r.user_id=NEW.user_id AND 'composer:'||r.session_id::text=NEW.project_id
          AND r.request_id=NEW.request_id AND r.model=NEW.model AND r.lease_id=NEW.lease_id AND r.state='preparing'
          AND r.lease_expires_at>clock_timestamp() AND r.call_id IS NULL AND NEW.response_index=0) INTO owned;
      ELSIF to_regclass('studio_image_turns') IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM studio_image_turns r WHERE r.user_id=NEW.user_id AND r.project_id=NEW.project_id AND r.request_id=NEW.request_id
          AND r.lease_id=NEW.lease_id AND r.state='thinking' AND r.lease_expires_at>clock_timestamp()) INTO owned;
      END IF;
      IF NOT owned THEN RAISE EXCEPTION 'Expanded output requires its active owned request lease'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_task_call_capacity ON studio_assistance_calls;
CREATE TRIGGER studio_task_call_capacity BEFORE INSERT ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_call_capacity();
-- The existing response trigger, when present, calls the updated function.
