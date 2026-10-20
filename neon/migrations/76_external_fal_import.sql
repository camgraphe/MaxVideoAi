-- Explicit external media provenance, with no legacy data, billing or media mutation.
-- Apply through the reviewed migration path before enabling the admin import CLI.
CREATE UNIQUE INDEX IF NOT EXISTS app_jobs_external_fal_request_unique
  ON app_jobs(provider_job_id)
  WHERE settings_snapshot->>'origin' = 'external_fal_import';
ALTER TABLE app_jobs DROP CONSTRAINT IF EXISTS app_jobs_external_fal_import_contract;
ALTER TABLE app_jobs ADD CONSTRAINT app_jobs_external_fal_import_contract CHECK (
  COALESCE(settings_snapshot->>'origin', '') <> 'external_fal_import' OR (
    provider = 'fal' AND surface = 'video' AND status = 'completed'
    AND user_id IS NOT NULL AND NULLIF(provider_job_id, '') IS NOT NULL
    AND final_price_cents IS NULL AND pricing_snapshot IS NULL AND cost_breakdown_usd IS NULL
    AND payment_status = 'external_not_billed' AND currency IS NULL
    AND stripe_payment_intent_id IS NULL AND stripe_charge_id IS NULL
    AND settings_snapshot#>>'{externalImport,schemaVersion}' = '1'
  ) IS TRUE
);
CREATE OR REPLACE FUNCTION preserve_external_fal_import_origin() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.settings_snapshot->>'origin' = 'external_fal_import' AND (
    NEW.settings_snapshot->>'origin' IS DISTINCT FROM 'external_fal_import'
    OR NEW.settings_snapshot->'externalImport' IS DISTINCT FROM OLD.settings_snapshot->'externalImport'
    OR NEW.provider_job_id IS DISTINCT FROM OLD.provider_job_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.engine_id IS DISTINCT FROM OLD.engine_id
  ) THEN RAISE EXCEPTION 'External Fal import provenance and ownership are immutable'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS app_jobs_preserve_external_fal_import ON app_jobs;
CREATE TRIGGER app_jobs_preserve_external_fal_import BEFORE UPDATE ON app_jobs
  FOR EACH ROW EXECUTE FUNCTION preserve_external_fal_import_origin();

CREATE OR REPLACE FUNCTION capture_generation_timing_sample() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE finished TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- External delivery is not application end-to-end generation latency.
  IF NEW.settings_snapshot->>'origin' = 'external_fal_import' THEN RETURN NEW; END IF;
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
