import { query } from '@/lib/db';

export async function ensureBillingCoreSchema(): Promise<void> {
    await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
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

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS engine_overrides (
        engine_id TEXT PRIMARY KEY,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        availability TEXT,
        status TEXT,
        latency_tier TEXT,
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
      CREATE INDEX IF NOT EXISTS engine_overrides_updated_idx ON engine_overrides (updated_at DESC);
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
      CREATE TABLE IF NOT EXISTS app_membership_tiers (
        tier TEXT PRIMARY KEY,
        spend_threshold_cents BIGINT NOT NULL DEFAULT 0,
        discount_percent NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT
      );
    `);

    await query(`
      INSERT INTO app_membership_tiers (tier, spend_threshold_cents, discount_percent)
      VALUES
        ('member', 0, 0),
        ('plus', 5000, 0.05),
        ('pro', 20000, 0.1)
      ON CONFLICT (tier) DO NOTHING;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS app_jobs (
        id BIGSERIAL PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        surface TEXT DEFAULT 'video',
        billing_product_key TEXT,
        engine_id TEXT NOT NULL,
        engine_label TEXT NOT NULL,
        duration_sec INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        thumb_url TEXT NOT NULL,
        video_url TEXT,
        preview_video_url TEXT,
        keyframe_urls JSONB,
        audio_url TEXT,
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
        provider TEXT NOT NULL DEFAULT 'fal',
        provider_job_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER NOT NULL DEFAULT 0,
        final_price_cents INTEGER,
        pricing_snapshot JSONB,
        cost_breakdown_usd JSONB,
        settings_snapshot JSONB,
        currency TEXT DEFAULT 'USD',
        vendor_account_id TEXT,
        payment_status TEXT DEFAULT 'platform',
        stripe_payment_intent_id TEXT,
        stripe_charge_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        hidden BOOLEAN DEFAULT FALSE,
        visibility TEXT DEFAULT 'public',
        indexable BOOLEAN DEFAULT TRUE,
        featured BOOLEAN DEFAULT FALSE,
        featured_order INTEGER DEFAULT 0,
        legacy_migrated BOOLEAN DEFAULT FALSE,
        provisional BOOLEAN DEFAULT FALSE
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_created_idx ON app_jobs (created_at DESC);
    `);

    await query(`
      ALTER TABLE app_jobs
      ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS surface TEXT DEFAULT 'video',
      ADD COLUMN IF NOT EXISTS billing_product_key TEXT,
      ADD COLUMN IF NOT EXISTS batch_id TEXT,
      ADD COLUMN IF NOT EXISTS group_id TEXT,
      ADD COLUMN IF NOT EXISTS iteration_index INTEGER,
      ADD COLUMN IF NOT EXISTS iteration_count INTEGER,
      ADD COLUMN IF NOT EXISTS render_ids JSONB,
      ADD COLUMN IF NOT EXISTS hero_render_id TEXT,
      ADD COLUMN IF NOT EXISTS local_key TEXT,
      ADD COLUMN IF NOT EXISTS message TEXT,
      ADD COLUMN IF NOT EXISTS eta_seconds INTEGER,
      ADD COLUMN IF NOT EXISTS eta_label TEXT,
      ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'fal',
      ADD COLUMN IF NOT EXISTS preview_video_url TEXT,
      ADD COLUMN IF NOT EXISTS keyframe_urls JSONB,
      ADD COLUMN IF NOT EXISTS audio_url TEXT,
      ADD COLUMN IF NOT EXISTS cost_breakdown_usd JSONB,
      ADD COLUMN IF NOT EXISTS settings_snapshot JSONB,
      ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public',
      ADD COLUMN IF NOT EXISTS indexable BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS legacy_migrated BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS provisional BOOLEAN DEFAULT FALSE;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_visibility_idx ON app_jobs (visibility, indexable);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_surface_created_idx ON app_jobs (surface, created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_user_created_idx
        ON app_jobs (user_id, created_at DESC)
        WHERE user_id IS NOT NULL;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_user_visible_created_id_idx
        ON app_jobs (user_id, created_at DESC, id DESC)
        WHERE user_id IS NOT NULL AND hidden IS NOT TRUE;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_user_surface_visible_created_id_idx
        ON app_jobs (user_id, surface, created_at DESC, id DESC)
        WHERE user_id IS NOT NULL AND hidden IS NOT TRUE;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_provider_job_idx
        ON app_jobs (provider_job_id)
        WHERE provider_job_id IS NOT NULL;
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_provider_pending_poll_idx
        ON app_jobs (provider, updated_at ASC)
        WHERE provider_job_id IS NOT NULL
          AND status IN ('pending', 'queued', 'running', 'processing', 'in_progress');
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS app_jobs_pending_poll_idx
        ON app_jobs (updated_at ASC)
        WHERE provider_job_id IS NOT NULL
          AND status IN ('pending', 'queued', 'running', 'processing', 'in_progress');
    `);
}
