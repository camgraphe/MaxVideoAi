-- Additive rollout: old code continues creating legacy rows. No financial reset.
ALTER TABLE prompt_assistance_requests
  ADD COLUMN IF NOT EXISTS execution_version text NOT NULL DEFAULT 'legacy-sync-v1',
  ADD COLUMN IF NOT EXISTS execution_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_owner text,
  ADD COLUMN IF NOT EXISTS worker_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_attempts integer NOT NULL DEFAULT 0;
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='prompt_assistance_requests'::regclass AND conname='prompt_assistance_execution_shape') THEN
ALTER TABLE prompt_assistance_requests ADD CONSTRAINT prompt_assistance_execution_shape CHECK (
  (execution_version='legacy-sync-v1' AND execution_deadline_at IS NULL AND execution_owner IS NULL AND worker_started_at IS NULL AND worker_attempts=0)
  OR (execution_version='durable-v1' AND execution_deadline_at=created_at+interval '600 seconds'
    AND execution_deadline_at IS NOT NULL AND length(execution_owner)>0 AND execution_owner IS NOT NULL
    AND worker_attempts BETWEEN 0 AND 2 AND (worker_started_at IS NULL)=(worker_attempts=0))
);
END IF;
END $$;
CREATE OR REPLACE FUNCTION enforce_prompt_assistance_execution_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.execution_version,NEW.execution_deadline_at,NEW.execution_owner)
      IS DISTINCT FROM (OLD.execution_version,OLD.execution_deadline_at,OLD.execution_owner)
    OR (OLD.worker_started_at IS NOT NULL AND NEW.worker_started_at IS DISTINCT FROM OLD.worker_started_at)
    OR NEW.worker_attempts<OLD.worker_attempts OR NEW.worker_attempts>OLD.worker_attempts+1 THEN
    RAISE EXCEPTION 'Prompt assistance execution identity and deadline are immutable';
  END IF;
  -- Compatibility with an old recover/claim UPDATE. Its RETURNING must still
  -- report pending while the saved preparation has a remaining retry/deadline.
  -- No context, identity, lease, evidence or financial mutation is swallowed.
  IF OLD.execution_version='durable-v1' AND OLD.state='preparing'
    AND OLD.call_id IS NULL AND OLD.response_json IS NULL
    AND OLD.lease_expires_at<=clock_timestamp() AND OLD.execution_deadline_at>clock_timestamp()
    AND OLD.worker_attempts<2 AND NEW.state='failed' AND NEW.error='REQUEST_INTERRUPTED'
    AND (to_jsonb(NEW)-'state'-'error'-'updated_at')=(to_jsonb(OLD)-'state'-'error'-'updated_at') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prompt_assistance_execution_identity ON prompt_assistance_requests;
CREATE TRIGGER prompt_assistance_execution_identity BEFORE UPDATE ON prompt_assistance_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_prompt_assistance_execution_identity();
CREATE INDEX IF NOT EXISTS prompt_assistance_worker_candidates ON prompt_assistance_requests(execution_owner,lease_expires_at,created_at)
  WHERE execution_version='durable-v1' AND state IN ('preparing','calling','reported','unknown','failed');
