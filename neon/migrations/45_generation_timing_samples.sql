-- Apply before the timing-matrix API. No job, output, billing or media mutation.
SET LOCAL TIME ZONE 'UTC';
CREATE TABLE IF NOT EXISTS generation_timing_samples (
  job_id TEXT PRIMARY KEY,
  engine_id TEXT NOT NULL,
  provider TEXT,
  mode TEXT,
  duration_sec INTEGER,
  resolution TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('job_completion', 'completion_log', 'provider_completion')),
  CHECK (completed_at > started_at)
);
CREATE INDEX IF NOT EXISTS generation_timing_samples_engine_completed_idx
  ON generation_timing_samples (engine_id, completed_at DESC);

-- One immutable snapshot per job; later polling/media repairs cannot move the clock.
-- Generic ownership deliberately supports future models and provider implementations.
CREATE OR REPLACE FUNCTION capture_generation_timing_sample() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE finished TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NEW.status = 'completed' AND NEW.surface = 'video'
     AND NULLIF(NEW.video_url, '') IS NOT NULL AND NEW.created_at < finished THEN
    -- Do not manufacture a completion for old completed jobs during a media repair.
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status = 'completed' AND NULLIF(OLD.video_url, '') IS NOT NULL THEN
        RETURN NEW;
      END IF;
    END IF;
    INSERT INTO generation_timing_samples
      (job_id, engine_id, provider, mode, duration_sec, resolution, started_at, completed_at, source)
    VALUES (NEW.job_id, NEW.engine_id, NEW.provider,
      NULLIF(LOWER(TRIM(COALESCE(NEW.settings_snapshot->>'inputMode', NEW.settings_snapshot->>'mode'))), ''), NEW.duration_sec,
      NULLIF(LOWER(TRIM(COALESCE(NEW.settings_snapshot#>>'{core,resolution}', NEW.settings_snapshot->>'resolution'))), ''),
      NEW.created_at, finished, 'job_completion')
    ON CONFLICT (job_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_jobs_capture_generation_timing ON app_jobs;
CREATE TRIGGER app_jobs_capture_generation_timing
  AFTER INSERT OR UPDATE OF status, video_url ON app_jobs
  FOR EACH ROW EXECUTE FUNCTION capture_generation_timing_sample();

-- Historical recovery uses explicit successful events only, never mutable updated_at
-- or request-duration metrics. Rerunning cannot duplicate/overwrite a newer snapshot.
INSERT INTO generation_timing_samples
  (job_id, engine_id, provider, mode, duration_sec, resolution, started_at, completed_at, source)
SELECT j.job_id, j.engine_id, j.provider,
  NULLIF(LOWER(TRIM(COALESCE(j.settings_snapshot->>'inputMode', j.settings_snapshot->>'mode'))), ''), j.duration_sec,
  NULLIF(LOWER(TRIM(COALESCE(j.settings_snapshot#>>'{core,resolution}', j.settings_snapshot->>'resolution'))), ''),
  j.created_at, COALESCE(log.completed_at, attempt.completed_at),
  CASE WHEN log.completed_at IS NOT NULL THEN 'completion_log' ELSE 'provider_completion' END
FROM app_jobs j
LEFT JOIN LATERAL (
  SELECT MIN(l.created_at::timestamptz) AS completed_at FROM fal_queue_log l
  WHERE l.job_id = j.job_id AND LOWER(l.status) IN ('completed', 'poll:completed')
    AND l.created_at::timestamptz > j.created_at
) log ON TRUE
LEFT JOIN LATERAL (
  SELECT MIN(p.finished_at) AS completed_at FROM provider_attempts p
  WHERE p.job_id = j.id AND p.provider = j.provider AND p.status = 'completed'
    AND p.finished_at > j.created_at
) attempt ON log.completed_at IS NULL
WHERE j.status = 'completed' AND j.surface = 'video'
  AND COALESCE(log.completed_at, attempt.completed_at) IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;
