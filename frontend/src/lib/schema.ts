import { query } from '@/lib/db';

let ensurePromise: Promise<void> | null = null;
let ensureAssetsPromise: Promise<void> | null = null;
let ensureEmailPromise: Promise<void> | null = null;

export async function ensureBillingSchema(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  const ensure = async () => {
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

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS engine_settings (
          engine_id TEXT PRIMARY KEY,
          options JSONB,
          pricing JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by UUID
        );
      `);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
      if (code !== '42P07' && code !== '23505') {
        throw error;
      }
    }

    try {
      await query(`
        CREATE INDEX IF NOT EXISTS engine_settings_updated_idx ON engine_settings (updated_at DESC);
      `);
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
      if (code !== '42P07' && code !== '23505') {
        throw error;
      }
    }

    await query(`
        INSERT INTO app_pricing_rules (
          id,
          margin_percent,
          margin_flat_cents,
          surcharge_audio_percent,
          surcharge_upscale_percent,
          currency,
          effective_from,
          created_at
        )
        VALUES ('default', 0.2, 0, 0.2, 0.5, 'USD', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
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
        ALTER TABLE app_receipts
        ADD COLUMN IF NOT EXISTS platform_revenue_cents BIGINT,
        ADD COLUMN IF NOT EXISTS destination_acct TEXT,
        ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS vendor_balances (
          id BIGSERIAL PRIMARY KEY,
          destination_acct TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'usd',
          pending_cents BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (destination_acct, currency)
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS payout_batches (
          id BIGSERIAL PRIMARY KEY,
          destination_acct TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'usd',
          amount_cents BIGINT NOT NULL,
          stripe_transfer_id TEXT,
          status TEXT NOT NULL DEFAULT 'created',
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          sent_at TIMESTAMPTZ
        );
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
  };

  ensurePromise = ensure().catch((error) => {
    ensurePromise = null;
    console.error('[schema] Failed to ensure app schema', error);
    throw error;
  });

  await ensurePromise;
}

export async function ensureAssetSchema(): Promise<void> {
  if (ensureAssetsPromise) return ensureAssetsPromise;

  const ensure = async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS user_assets (
        id BIGSERIAL PRIMARY KEY,
        asset_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        url TEXT NOT NULL,
        mime_type TEXT,
        width INTEGER,
        height INTEGER,
        size_bytes BIGINT,
        source TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS user_assets_user_created_idx ON user_assets (user_id, created_at DESC);
    `);
  };

  ensureAssetsPromise = ensure().catch((error) => {
    ensureAssetsPromise = null;
    console.error('[schema] Failed to ensure asset schema', error);
    throw error;
  });

  await ensureAssetsPromise;
}

export async function ensureEmailSchema(): Promise<void> {
  if (ensureEmailPromise) return ensureEmailPromise;

  const ensure = async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS email_events (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        event_type TEXT NOT NULL,
        recipient TEXT,
        provider_id TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS email_events_recipient_idx ON email_events (recipient);
    `);
  };

  ensureEmailPromise = ensure().catch((error) => {
    ensureEmailPromise = null;
    console.error('[schema] Failed to ensure email schema', error);
    throw error;
  });

  await ensureEmailPromise;
}
