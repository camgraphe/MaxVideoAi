-- Add JSONB column for detailed pricing breakdown per job
ALTER TABLE app_jobs
  ADD COLUMN IF NOT EXISTS cost_breakdown_usd JSONB;

-- Backfill from historical pricing_snapshot metadata when available
UPDATE app_jobs
SET cost_breakdown_usd = pricing_snapshot -> 'meta' -> 'cost_breakdown_usd'
WHERE cost_breakdown_usd IS NULL
  AND pricing_snapshot ? 'meta'
  AND (pricing_snapshot -> 'meta') ? 'cost_breakdown_usd';
