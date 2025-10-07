-- Neon Postgres schema for billing/receipts

CREATE TABLE IF NOT EXISTS receipts (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('topup','charge','discount','tax','refund')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  job_id TEXT,
  pricing_snapshot JSONB,
  application_fee_cents INTEGER DEFAULT 0,
  vendor_account_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receipts_user_created_idx ON receipts (user_id, created_at DESC);

-- Jobs table for engines history
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  engine_id TEXT NOT NULL,
  engine_label TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  thumb_url TEXT NOT NULL,
  video_url TEXT,
  aspect_ratio TEXT,
  has_audio BOOLEAN DEFAULT FALSE,
  can_upscale BOOLEAN DEFAULT FALSE,
  preview_frame TEXT,
  provider_job_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | completed | failed
  progress INTEGER NOT NULL DEFAULT 0,
  final_price_cents INTEGER,
  pricing_snapshot JSONB,
  currency TEXT DEFAULT 'USD',
  vendor_account_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_created_idx ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_user_created_idx ON jobs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id TEXT PRIMARY KEY,
  engine_id TEXT,
  resolution TEXT,
  margin_percent NUMERIC DEFAULT 0,
  margin_flat_cents INTEGER DEFAULT 0,
  surcharge_audio_percent NUMERIC DEFAULT 0,
  surcharge_upscale_percent NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  vendor_account_id TEXT,
  effective_from TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
