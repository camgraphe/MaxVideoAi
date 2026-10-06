-- Explicit migration only. Resource policy is separate from frozen v1/v2 tariffs.
CREATE TABLE IF NOT EXISTS studio_tasks (
  user_id text NOT NULL, project_id text NOT NULL REFERENCES studio_projects(id), request_id uuid NOT NULL, segment_request_id uuid NOT NULL,
  input_hash text NOT NULL, input_json jsonb NOT NULL, source_fingerprint text NOT NULL,
  policy_version text NOT NULL CHECK(policy_version='studio-task-budget-2026-10-06-v1'),
  profile text NOT NULL CHECK(profile IN ('quick','standard','complex')), profile_json jsonb NOT NULL,
  model text NOT NULL CHECK(model IN ('gpt-6.1-sol','gpt-6-luna')),
  state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','paused','completed','failed','unknown')),
  phase text NOT NULL DEFAULT 'queued' CHECK(phase IN ('queued','thinking','reading','preparing','editing','recovering','done','paused','unknown')),
  max_credits integer NOT NULL CHECK(max_credits BETWEEN 100 AND 2000 AND max_credits%10=0),
  allowed_calls integer NOT NULL CHECK(allowed_calls BETWEEN 1 AND 24), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  worker_id uuid, lease_expires_at timestamptz, deadline_at timestamptz,
  partial_reply text CHECK(length(partial_reply)<=2400),
  error text CHECK(error IN ('budget','steps','output','deadline','context','funding','provider','permission','unavailable')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,project_id,request_id),
  FOREIGN KEY(user_id,project_id,request_id) REFERENCES studio_assistance_turns(user_id,project_id,request_id),
  CHECK(profile<>'complex' OR model='gpt-6.1-sol')
);
CREATE UNIQUE INDEX IF NOT EXISTS studio_tasks_one_active_account ON studio_tasks(user_id) WHERE state IN ('queued','running','unknown');
CREATE INDEX IF NOT EXISTS studio_tasks_queue ON studio_tasks(created_at) WHERE state='queued';
CREATE TABLE IF NOT EXISTS studio_task_segments (
  user_id text NOT NULL, project_id text NOT NULL, task_request_id uuid NOT NULL, request_id uuid NOT NULL,
  max_calls integer NOT NULL CHECK(max_calls BETWEEN 1 AND 8),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,project_id,request_id),
  FOREIGN KEY(user_id,project_id,task_request_id) REFERENCES studio_tasks(user_id,project_id,request_id),
  FOREIGN KEY(user_id,project_id,request_id) REFERENCES studio_assistance_turns(user_id,project_id,request_id)
);
CREATE TABLE IF NOT EXISTS studio_task_approvals (
  user_id text NOT NULL, project_id text NOT NULL, request_id uuid NOT NULL, approval_id uuid NOT NULL,
  revision integer NOT NULL, payload jsonb NOT NULL, max_credits integer NOT NULL, allowed_calls integer NOT NULL, segment_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,approval_id), UNIQUE(user_id,project_id,request_id,revision),
  FOREIGN KEY(user_id,project_id,request_id) REFERENCES studio_tasks(user_id,project_id,request_id)
);
CREATE TABLE IF NOT EXISTS studio_task_memory_notes (
  user_id text NOT NULL, project_id text NOT NULL REFERENCES studio_projects(id), request_id uuid NOT NULL,
  message text NOT NULL CHECK(length(message) BETWEEN 1 AND 4000), reference_ids jsonb NOT NULL,
  search_document tsvector GENERATED ALWAYS AS (to_tsvector('simple',message)) STORED,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,project_id,request_id)
);
CREATE INDEX IF NOT EXISTS studio_task_memory_search ON studio_task_memory_notes USING gin(search_document);
CREATE OR REPLACE FUNCTION enforce_studio_task_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_credits integer; expected_calls integer;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Task approval and financial identity are immutable'; END IF;
  IF TG_TABLE_NAME<>'studio_tasks' THEN
    IF TG_OP='UPDATE' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Task evidence is immutable'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN
    expected_credits:=CASE NEW.profile WHEN 'quick' THEN 100 WHEN 'standard' THEN 250 ELSE 500 END;
    expected_calls:=CASE NEW.profile WHEN 'quick' THEN 2 WHEN 'standard' THEN 4 ELSE 8 END;
    IF NEW.max_credits<>expected_credits OR NEW.allowed_calls<>expected_calls OR NEW.revision<>0 OR NEW.segment_request_id<>NEW.request_id
      OR NEW.profile_json->>'maxCredits'<>expected_credits::text OR NEW.profile_json->>'maxCalls'<>expected_calls::text
      OR NEW.input_json->'taskBudget'->>'profile'<>NEW.profile
      OR NEW.input_json->'taskBudget'->>'policyVersion'<>NEW.policy_version
      OR NEW.input_json->'taskBudget'->>'maxCredits'<>expected_credits::text
      OR (NEW.profile='complex' AND NEW.input_json->'taskBudget'->>'confirmedComplex' IS DISTINCT FROM 'true')
      OR NOT EXISTS(SELECT 1 FROM studio_assistance_turns a WHERE a.user_id=NEW.user_id AND a.project_id=NEW.project_id AND a.request_id=NEW.request_id AND a.model=NEW.model) THEN
      RAISE EXCEPTION 'Task needs its exact reviewed resource policy and frozen assistance';
    END IF;
  ELSE
    IF (to_jsonb(NEW)-ARRAY['state','phase','max_credits','allowed_calls','revision','segment_request_id','worker_id','lease_expires_at','deadline_at','partial_reply','error','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','phase','max_credits','allowed_calls','revision','segment_request_id','worker_id','lease_expires_at','deadline_at','partial_reply','error','updated_at']) THEN
      RAISE EXCEPTION 'Task identity and initial policy are immutable';
    END IF;
    IF (NEW.max_credits,NEW.allowed_calls,NEW.revision,NEW.segment_request_id) IS DISTINCT FROM (OLD.max_credits,OLD.allowed_calls,OLD.revision,OLD.segment_request_id)
      AND (NEW.revision<>OLD.revision+1 OR NOT EXISTS(SELECT 1 FROM studio_task_approvals a WHERE a.user_id=NEW.user_id AND a.project_id=NEW.project_id AND a.request_id=NEW.request_id AND a.revision=NEW.revision AND a.max_credits=NEW.max_credits AND a.allowed_calls=NEW.allowed_calls AND a.segment_request_id=NEW.segment_request_id)) THEN
      RAISE EXCEPTION 'Resource extension needs its exact client approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_tasks_identity ON studio_tasks;
CREATE TRIGGER studio_tasks_identity BEFORE INSERT OR UPDATE OR DELETE ON studio_tasks FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_identity();
DROP TRIGGER IF EXISTS studio_task_approvals_identity ON studio_task_approvals;
CREATE TRIGGER studio_task_approvals_identity BEFORE UPDATE OR DELETE ON studio_task_approvals FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_identity();
DROP TRIGGER IF EXISTS studio_task_notes_identity ON studio_task_memory_notes;
CREATE TRIGGER studio_task_notes_identity BEFORE UPDATE OR DELETE ON studio_task_memory_notes FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_identity();
DROP TRIGGER IF EXISTS studio_task_segments_identity ON studio_task_segments;
CREATE TRIGGER studio_task_segments_identity BEFORE UPDATE OR DELETE ON studio_task_segments FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_identity();

ALTER TABLE studio_assistance_calls DROP CONSTRAINT IF EXISTS studio_assistance_calls_response_index_check;
ALTER TABLE studio_assistance_calls ADD CONSTRAINT studio_assistance_calls_response_index_check CHECK(response_index BETWEEN 0 AND 23);
ALTER TABLE studio_assistance_calls DROP CONSTRAINT IF EXISTS studio_assistance_calls_output_token_bound_check;
ALTER TABLE studio_assistance_calls ADD CONSTRAINT studio_assistance_calls_output_token_bound_check CHECK(output_token_bound BETWEEN 0 AND 6000);
ALTER TABLE studio_conversation_responses DROP CONSTRAINT IF EXISTS studio_conversation_responses_response_index_check;
ALTER TABLE studio_conversation_responses ADD CONSTRAINT studio_conversation_responses_response_index_check CHECK(response_index BETWEEN 0 AND 23);
CREATE OR REPLACE FUNCTION enforce_studio_task_call_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE task studio_tasks; segment_limit integer;
BEGIN
  SELECT t.* INTO task FROM studio_tasks t JOIN studio_task_segments s ON s.user_id=t.user_id AND s.project_id=t.project_id AND s.task_request_id=t.request_id
    WHERE s.user_id=NEW.user_id AND s.project_id=NEW.project_id AND s.request_id=NEW.request_id;
  IF NOT FOUND THEN
    IF NEW.response_index>3 OR (TG_TABLE_NAME='studio_assistance_calls' AND to_jsonb(NEW)->>'output_token_bound' IS NOT NULL AND (to_jsonb(NEW)->>'output_token_bound')::int>2200) THEN
      RAISE EXCEPTION 'Expanded resource bounds require an owned task policy';
    END IF;
  ELSE
    SELECT max_calls INTO segment_limit FROM studio_task_segments WHERE user_id=NEW.user_id AND project_id=NEW.project_id AND request_id=NEW.request_id;
    IF task.state<>'running' OR task.worker_id IS DISTINCT FROM NEW.lease_id OR task.segment_request_id<>NEW.request_id OR task.lease_expires_at<=clock_timestamp() OR task.deadline_at<=clock_timestamp()
      OR NEW.response_index>=segment_limit
      OR (TG_TABLE_NAME='studio_assistance_calls' AND ((to_jsonb(NEW)->>'output_token_bound')::int>(task.profile_json->>'maxOutputTokens')::int OR (to_jsonb(NEW)->>'input_token_bound')::int>(task.profile_json->>'maxInputTokens')::int)) THEN
      RAISE EXCEPTION 'Task resource bound or worker lease is invalid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_task_call_capacity ON studio_assistance_calls;
CREATE TRIGGER studio_task_call_capacity BEFORE INSERT ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_call_capacity();
DROP TRIGGER IF EXISTS studio_task_response_capacity ON studio_conversation_responses;
CREATE TRIGGER studio_task_response_capacity BEFORE INSERT ON studio_conversation_responses FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_call_capacity();
