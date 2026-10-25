-- MEAS-01: apply explicitly BEFORE deploying the reservation writers.
-- No defaults or backfill: existing and uninstrumented rows remain NULL.
BEGIN;
ALTER TABLE app_jobs
  ADD COLUMN IF NOT EXISTS entry_surface text,
  ADD COLUMN IF NOT EXISTS entry_source text,
  ADD COLUMN IF NOT EXISTS journey_version smallint,
  ADD COLUMN IF NOT EXISTS entry_release_sha text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app_jobs'::regclass AND conname = 'app_jobs_journey_context_check') THEN
    ALTER TABLE app_jobs ADD CONSTRAINT app_jobs_journey_context_check CHECK ((
      (entry_surface IS NULL AND entry_source IS NULL AND journey_version IS NULL AND entry_release_sha IS NULL)
      OR (journey_version = 1
        AND ((entry_surface = 'generator' AND entry_source = 'web_route')
          OR (entry_surface IN ('tool', 'studio', 'mcp') AND entry_source = 'confirmed_actor')
          OR (entry_surface = 'unknown' AND entry_source = 'unknown'))
        AND (entry_release_sha IS NULL OR entry_release_sha ~ '^[0-9a-f]{40}$'))
    ) IS TRUE);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION preserve_app_job_journey_context() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.entry_surface IS DISTINCT FROM OLD.entry_surface
    OR NEW.entry_source IS DISTINCT FROM OLD.entry_source
    OR NEW.journey_version IS DISTINCT FROM OLD.journey_version
    OR NEW.entry_release_sha IS DISTINCT FROM OLD.entry_release_sha THEN
    RAISE EXCEPTION 'Job journey context is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS app_jobs_journey_context_immutable ON app_jobs;
CREATE TRIGGER app_jobs_journey_context_immutable
  BEFORE UPDATE OF entry_surface, entry_source, journey_version, entry_release_sha ON app_jobs
  FOR EACH ROW EXECUTE FUNCTION preserve_app_job_journey_context();
COMMIT;
