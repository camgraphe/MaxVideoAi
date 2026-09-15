-- Preserve original app delivery timestamps; record provider execution separately.
ALTER TABLE generation_timing_samples ADD COLUMN IF NOT EXISTS provider_duration_ms DOUBLE PRECISION
  CHECK (provider_duration_ms > 0);

CREATE OR REPLACE FUNCTION generation_provider_duration_ms(provider_name TEXT, response JSONB)
RETURNS DOUBLE PRECISION LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE started TIMESTAMP; ended TIMESTAMP; duration_ms DOUBLE PRECISION;
BEGIN
  IF provider_name IS DISTINCT FROM 'alibaba_model_studio' OR response#>>'{output,task_status}' IS DISTINCT FROM 'SUCCEEDED' THEN
    RETURN NULL;
  END IF;
  -- Both provider timestamps share a timezone; subtract locally, never guess UTC.
  IF response#>>'{output,submit_time}' IS NULL OR response#>>'{output,end_time}' IS NULL THEN RETURN NULL; END IF;
  started := (response#>>'{output,submit_time}')::TIMESTAMP;
  ended := (response#>>'{output,end_time}')::TIMESTAMP;
  duration_ms := EXTRACT(EPOCH FROM (ended - started)) * 1000;
  IF duration_ms > 0 AND isfinite(started) AND isfinite(ended) THEN RETURN duration_ms; END IF;
  RETURN NULL;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION capture_provider_generation_timing() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE generation_timing_samples s
       SET provider_duration_ms = generation_provider_duration_ms(NEW.provider, NEW.response_snapshot)
      FROM app_jobs j
     WHERE j.id = NEW.job_id AND s.job_id = j.job_id AND s.provider = NEW.provider
       AND s.provider_duration_ms IS NULL
       AND generation_provider_duration_ms(NEW.provider, NEW.response_snapshot) > 0;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS provider_attempts_capture_generation_timing ON provider_attempts;
CREATE TRIGGER provider_attempts_capture_generation_timing
  AFTER INSERT OR UPDATE OF status, response_snapshot ON provider_attempts
  FOR EACH ROW EXECUTE FUNCTION capture_provider_generation_timing();

-- Repair only timing metadata. No job/media/payment mutation and no lost timestamps.
UPDATE generation_timing_samples s
   SET provider_duration_ms = generation_provider_duration_ms(p.provider, p.response_snapshot)
  FROM app_jobs j JOIN provider_attempts p ON p.job_id = j.id AND p.provider = j.provider
 WHERE s.job_id = j.job_id AND s.provider = p.provider AND p.status = 'completed'
   AND s.provider_duration_ms IS NULL
   AND generation_provider_duration_ms(p.provider, p.response_snapshot) > 0;
UPDATE generation_timing_samples s
   SET resolution = NULLIF(LOWER(TRIM(j.settings_snapshot#>>'{settings,resolution}')), '')
  FROM app_jobs j WHERE s.job_id = j.job_id AND s.resolution IS NULL;

CREATE OR REPLACE FUNCTION capture_generation_timing_sample() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE finished TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NEW.status = 'completed' AND NEW.surface = 'video'
     AND NULLIF(NEW.video_url, '') IS NOT NULL AND NEW.created_at < finished THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status = 'completed' AND NULLIF(OLD.video_url, '') IS NOT NULL THEN RETURN NEW; END IF;
    END IF;
    INSERT INTO generation_timing_samples
      (job_id, engine_id, provider, mode, duration_sec, resolution, started_at, completed_at, source, provider_duration_ms)
    VALUES (NEW.job_id, NEW.engine_id, NEW.provider,
      NULLIF(LOWER(TRIM(COALESCE(NEW.settings_snapshot->>'inputMode', NEW.settings_snapshot->>'mode'))), ''), NEW.duration_sec,
      NULLIF(LOWER(TRIM(COALESCE(NEW.settings_snapshot#>>'{core,resolution}', NEW.settings_snapshot->>'resolution', NEW.settings_snapshot#>>'{settings,resolution}'))), ''),
      NEW.created_at, finished, 'job_completion',
      (SELECT generation_provider_duration_ms(p.provider, p.response_snapshot) FROM provider_attempts p
        WHERE p.job_id = NEW.id AND p.provider = NEW.provider AND p.status = 'completed'
          AND generation_provider_duration_ms(p.provider, p.response_snapshot) > 0
        ORDER BY p.finished_at ASC LIMIT 1))
    ON CONFLICT (job_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
