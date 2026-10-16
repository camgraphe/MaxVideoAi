-- Apply explicitly before the v2 Studio task runtime. Existing frozen tasks,
-- assistance tariffs, credit lots and customer ceilings are not rewritten.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
    WHERE conrelid='studio_tasks'::regclass AND conname='studio_tasks_policy_version_check';
  IF definition IS DISTINCT FROM 'CHECK ((policy_version = ''studio-task-budget-2026-10-06-v1''::text))'
    AND definition IS DISTINCT FROM 'CHECK ((policy_version = ANY (ARRAY[''studio-task-budget-2026-10-06-v1''::text, ''studio-task-budget-2026-10-11-v2''::text])))' THEN
    RAISE EXCEPTION 'Unexpected Studio task policy constraint; review its published source before migration';
  END IF;
END $$;
ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_policy_version_check;
ALTER TABLE studio_tasks ADD CONSTRAINT studio_tasks_policy_version_check
  CHECK(policy_version IN ('studio-task-budget-2026-10-06-v1','studio-task-budget-2026-10-11-v2'));

CREATE OR REPLACE FUNCTION enforce_studio_task_resource_policy_v2() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_reasoning text; expected_output integer;
BEGIN
  IF NEW.policy_version='studio-task-budget-2026-10-11-v2' THEN
    expected_reasoning:=CASE WHEN NEW.model='gpt-6-luna' OR NEW.profile='complex' THEN 'high'
      WHEN NEW.profile='standard' THEN 'medium' ELSE 'low' END;
    expected_output:=CASE WHEN NEW.model='gpt-6-luna' OR NEW.profile='complex' THEN 6000 ELSE 2200 END;
    IF NEW.profile_json->>'reasoning' IS DISTINCT FROM expected_reasoning
      OR NEW.profile_json->>'maxOutputTokens' IS DISTINCT FROM expected_output::text THEN
      RAISE EXCEPTION 'Task needs its exact reviewed reasoning and output allowance';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_task_resource_policy_v2 ON studio_tasks;
CREATE TRIGGER studio_task_resource_policy_v2 BEFORE INSERT ON studio_tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_resource_policy_v2();
