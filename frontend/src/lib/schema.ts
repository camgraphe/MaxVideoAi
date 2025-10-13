import { query } from '@/lib/db';

let ensurePromise: Promise<void> | null = null;

export async function ensureBillingSchema(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS app_pricing_rules (
          id TEXT PRIMARY KEY,
          engine_id TEXT,
          resolution TEXT,
          margin_percent NUMERIC DEFAULT 0,
          margin_flat_cents INTEGER DEFAULT 0,
          surcharge_audio_percent NUMERIC DEFAULT 0,
          surcharge_upscale_percent NUMERIC DEFAULT 0,
          currency TEXT DEFAULT 'USD',
          vendor_account_id TEXT,
          effective_from TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS app_jobs (
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
          batch_id TEXT,
          group_id TEXT,
          iteration_index INTEGER,
          iteration_count INTEGER,
          render_ids JSONB,
          hero_render_id TEXT,
          local_key TEXT,
          message TEXT,
          eta_seconds INTEGER,
          eta_label TEXT,
          provider_job_id TEXT,
          status TEXT NOT NULL DEFAULT 'queued',
          progress INTEGER NOT NULL DEFAULT 0,
          final_price_cents INTEGER,
          pricing_snapshot JSONB,
          currency TEXT DEFAULT 'USD',
          vendor_account_id TEXT,
          payment_status TEXT DEFAULT 'platform',
          stripe_payment_intent_id TEXT,
          stripe_charge_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          hidden BOOLEAN DEFAULT FALSE
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_jobs_created_idx ON app_jobs (created_at DESC);
      `);

      await query(`
        ALTER TABLE app_jobs
        ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS batch_id TEXT,
        ADD COLUMN IF NOT EXISTS group_id TEXT,
        ADD COLUMN IF NOT EXISTS iteration_index INTEGER,
        ADD COLUMN IF NOT EXISTS iteration_count INTEGER,
        ADD COLUMN IF NOT EXISTS render_ids JSONB,
        ADD COLUMN IF NOT EXISTS hero_render_id TEXT,
        ADD COLUMN IF NOT EXISTS local_key TEXT,
        ADD COLUMN IF NOT EXISTS message TEXT,
        ADD COLUMN IF NOT EXISTS eta_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS eta_label TEXT;
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS app_receipts (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('topup','charge','refund','discount','tax')),
          amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
          currency TEXT NOT NULL DEFAULT 'USD',
          description TEXT,
          metadata JSONB,
          job_id TEXT,
          pricing_snapshot JSONB,
          application_fee_cents INTEGER DEFAULT 0,
          vendor_account_id TEXT,
          stripe_payment_intent_id TEXT,
          stripe_charge_id TEXT,
          stripe_refund_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_receipts_user_created_idx ON app_receipts (user_id, created_at DESC);
      `);

      await query(`
        ALTER TABLE app_receipts
        ADD COLUMN IF NOT EXISTS metadata JSONB;
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS fal_queue_log (
          id BIGSERIAL PRIMARY KEY,
          job_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_job_id TEXT,
          engine_id TEXT NOT NULL,
          status TEXT NOT NULL,
          payload JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS fal_queue_log_job_idx ON fal_queue_log (job_id, created_at DESC);
      `);
    } catch (error) {
      console.error('[schema] Failed to ensure app schema', error);
    }
  })();

  await ensurePromise;
}
