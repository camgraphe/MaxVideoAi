-- Append the third resource policy. Never rewrite saved v1/v2 task profiles.
ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_model_check;
ALTER TABLE studio_tasks ADD CONSTRAINT studio_tasks_model_check CHECK(model IN ('gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna'));
ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_policy_version_check;
ALTER TABLE studio_tasks ADD CONSTRAINT studio_tasks_policy_version_check CHECK(policy_version IN ('studio-task-budget-2026-10-06-v1','studio-task-budget-2026-10-11-v2','studio-task-budget-2026-10-29-v3'));
CREATE OR REPLACE FUNCTION enforce_studio_task_resource_policy_v3() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.model='gpt-6.1-terra' AND NEW.policy_version<>'studio-task-budget-2026-10-29-v3' THEN RAISE EXCEPTION 'Terra requires the current task policy'; END IF;
  IF NEW.policy_version='studio-task-budget-2026-10-29-v3' AND (
    NEW.profile_json->>'reasoning' IS DISTINCT FROM (CASE WHEN NEW.model='gpt-6.1-sol' THEN 'xhigh' ELSE 'high' END)
    OR NEW.profile_json->>'maxOutputTokens' IS DISTINCT FROM '6000') THEN
    RAISE EXCEPTION 'Task needs its exact reviewed reasoning and output allowance';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS studio_task_resource_policy_v3 ON studio_tasks;
CREATE TRIGGER studio_task_resource_policy_v3 BEFORE INSERT ON studio_tasks FOR EACH ROW EXECUTE FUNCTION enforce_studio_task_resource_policy_v3();
