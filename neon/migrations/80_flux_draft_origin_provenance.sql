-- Explicit compatibility upgrade for already-created 79 tables; no job/attempt backfill.
ALTER TABLE flux_draft_cache_sources ALTER COLUMN attempt_id DROP NOT NULL;
ALTER TABLE flux_draft_cache_sources ADD COLUMN IF NOT EXISTS origin_kind text NOT NULL DEFAULT 'provider_attempt';
ALTER TABLE flux_draft_cache_sources ADD COLUMN IF NOT EXISTS origin_proof jsonb;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='flux_draft_cache_sources'::regclass AND conname='flux_draft_origin_provenance') THEN
ALTER TABLE flux_draft_cache_sources ADD CONSTRAINT flux_draft_origin_provenance CHECK (
  (origin_kind='provider_attempt' AND attempt_id IS NOT NULL AND attempt_id>0 AND origin_proof IS NULL)
  OR (origin_kind IN ('fal_submission','canonical_queue') AND attempt_id IS NULL AND origin_proof IS NOT NULL
    AND jsonb_typeof(origin_proof)='object' AND (origin_proof->>'kind'=origin_kind) IS TRUE AND (qualified_source->'provenance'=origin_proof) IS TRUE)
);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='flux_draft_cache_sources'::regclass AND conname='flux_draft_qualified_origin_kind') THEN
ALTER TABLE flux_draft_cache_sources ADD CONSTRAINT flux_draft_qualified_origin_kind CHECK (
  COALESCE(qualified_source->'provenance'->>'kind','provider_attempt')=origin_kind
);
END IF;
END $$;
REVOKE ALL ON flux_draft_cache_sources FROM PUBLIC;
