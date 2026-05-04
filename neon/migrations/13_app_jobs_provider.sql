ALTER TABLE app_jobs
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'fal';

UPDATE app_jobs
   SET provider = 'fal'
 WHERE provider IS NULL OR provider = '';

CREATE INDEX IF NOT EXISTS app_jobs_provider_pending_poll_idx
  ON app_jobs (provider, updated_at ASC)
  WHERE provider_job_id IS NOT NULL
    AND status IN ('pending', 'queued', 'running', 'processing', 'in_progress');
