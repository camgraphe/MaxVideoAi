-- Adds pricing metadata storage for jobs and receipts
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS final_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS job_id TEXT,
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS application_fee_cents INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS pricing_rules (
  id TEXT PRIMARY KEY,
  engine_id TEXT,
  resolution TEXT,
  margin_percent NUMERIC DEFAULT 0,
  margin_flat_cents INTEGER DEFAULT 0,
  surcharge_audio_percent NUMERIC DEFAULT 0,
  surcharge_upscale_percent NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pricing_rules IS 'Pricing hierarchy for engines / resolutions (highest specificity first).';
