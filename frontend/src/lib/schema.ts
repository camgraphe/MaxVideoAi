import { query } from '@/lib/db';

const FEATURE_LAUNCH_TIMESTAMP: string = (() => {
  const fromEnv =
    process.env.FEATURE_LAUNCH_TIMESTAMP ??
    process.env.NEXT_PUBLIC_FEATURE_LAUNCH_TIMESTAMP;
  if (fromEnv && fromEnv.trim().length) {
    return fromEnv.trim();
  }
  return '2025-01-01T00:00:00Z';
})();

let ensurePromise: Promise<void> | null = null;
let ensureAssetsPromise: Promise<void> | null = null;
let ensureEmailPromise: Promise<void> | null = null;

export async function ensureBillingSchema(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  const ensure = async () => {
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

      await query(`
        CREATE TABLE IF NOT EXISTS app_billing_products (
          product_key TEXT PRIMARY KEY,
          surface TEXT NOT NULL,
          label TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          unit_kind TEXT NOT NULL CHECK (unit_kind IN ('image','run')),
          unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
          active BOOLEAN NOT NULL DEFAULT TRUE,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        INSERT INTO app_billing_products (
          product_key,
          surface,
          label,
          currency,
          unit_kind,
          unit_price_cents,
          active,
          metadata
        )
        VALUES
          ('character-draft', 'character', 'Character Draft', 'USD', 'image', 8, TRUE, '{"seeded":true,"tool":"character-builder","qualityMode":"draft"}'::jsonb),
          ('character-final', 'character', 'Character Final', 'USD', 'image', 15, TRUE, '{"seeded":true,"tool":"character-builder","qualityMode":"final"}'::jsonb),
          ('angle-flux-single', 'angle', 'Angle FLUX Single', 'USD', 'run', 4, TRUE, '{"seeded":true,"tool":"angle","engineId":"flux-multiple-angles","variant":"single"}'::jsonb),
          ('angle-flux-multi', 'angle', 'Angle FLUX Multi', 'USD', 'run', 24, TRUE, '{"seeded":true,"tool":"angle","engineId":"flux-multiple-angles","variant":"multi"}'::jsonb),
          ('angle-qwen-single', 'angle', 'Angle Qwen Single', 'USD', 'run', 7, TRUE, '{"seeded":true,"tool":"angle","engineId":"qwen-multiple-angles","variant":"single"}'::jsonb),
          ('angle-qwen-multi', 'angle', 'Angle Qwen Multi', 'USD', 'run', 40, TRUE, '{"seeded":true,"tool":"angle","engineId":"qwen-multiple-angles","variant":"multi"}'::jsonb),
          ('upscale-image-seedvr', 'upscale', 'Upscale Image SeedVR2', 'USD', 'run', 4, TRUE, '{"seeded":true,"tool":"upscale","engineId":"seedvr-image","mediaType":"image"}'::jsonb),
          ('upscale-image-topaz', 'upscale', 'Upscale Image Topaz', 'USD', 'run', 12, TRUE, '{"seeded":true,"tool":"upscale","engineId":"topaz-image","mediaType":"image"}'::jsonb),
          ('upscale-image-recraft-crisp', 'upscale', 'Upscale Image Recraft Crisp', 'USD', 'run', 2, TRUE, '{"seeded":true,"tool":"upscale","engineId":"recraft-crisp","mediaType":"image"}'::jsonb),
          ('upscale-video-seedvr', 'upscale', 'Upscale Video SeedVR2', 'USD', 'run', 25, TRUE, '{"seeded":true,"tool":"upscale","engineId":"seedvr-video","mediaType":"video","dynamicPricing":true}'::jsonb),
          ('upscale-video-flashvsr', 'upscale', 'Upscale Video FlashVSR', 'USD', 'run', 18, TRUE, '{"seeded":true,"tool":"upscale","engineId":"flashvsr-video","mediaType":"video","dynamicPricing":true}'::jsonb),
          ('upscale-video-topaz', 'upscale', 'Upscale Video Topaz', 'USD', 'run', 80, TRUE, '{"seeded":true,"tool":"upscale","engineId":"topaz-video","mediaType":"video","dynamicPricing":true}'::jsonb)
        ON CONFLICT (product_key) DO NOTHING;
      `);

      await query(`
        UPDATE app_billing_products
           SET active = FALSE,
               metadata = COALESCE(metadata, '{}'::jsonb) || '{"legacy":true}'::jsonb,
               updated_at = NOW()
         WHERE product_key IN ('angle-single', 'angle-multi')
           AND COALESCE(metadata->>'legacy', 'false') <> 'true';
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
          surface TEXT,
          billing_product_key TEXT,
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
        ALTER TABLE app_receipts
        ADD COLUMN IF NOT EXISTS original_amount_cents INTEGER,
        ADD COLUMN IF NOT EXISTS original_currency TEXT,
        ADD COLUMN IF NOT EXISTS fx_rate NUMERIC,
        ADD COLUMN IF NOT EXISTS fx_margin_bps INTEGER,
        ADD COLUMN IF NOT EXISTS fx_rate_timestamp TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS surface TEXT,
        ADD COLUMN IF NOT EXISTS billing_product_key TEXT,
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
        ADD COLUMN IF NOT EXISTS stripe_hosted_invoice_url TEXT,
        ADD COLUMN IF NOT EXISTS stripe_invoice_pdf TEXT,
        ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT,
        ADD COLUMN IF NOT EXISTS stripe_document_synced_at TIMESTAMPTZ;
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_receipts_user_created_idx ON app_receipts (user_id, created_at DESC);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_receipts_job_type_created_idx
          ON app_receipts (job_id, type, created_at DESC)
          WHERE job_id IS NOT NULL;
      `);

      await query(`
        ALTER TABLE app_receipts
        ADD COLUMN IF NOT EXISTS metadata JSONB;
      `);

      await query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY stripe_payment_intent_id, type ORDER BY id) AS row_num
          FROM app_receipts
          WHERE stripe_payment_intent_id IS NOT NULL
        )
        UPDATE app_receipts
        SET stripe_payment_intent_id = NULL
        WHERE id IN (SELECT id FROM ranked WHERE row_num > 1);
      `);

      await query(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY stripe_charge_id, type ORDER BY id) AS row_num
          FROM app_receipts
          WHERE stripe_charge_id IS NOT NULL
        )
        UPDATE app_receipts
        SET stripe_charge_id = NULL
        WHERE id IN (SELECT id FROM ranked WHERE row_num > 1);
      `);

      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_unique_pi ON app_receipts (stripe_payment_intent_id)
        WHERE stripe_payment_intent_id IS NOT NULL;
      `);

      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_unique_charge ON app_receipts (stripe_charge_id)
        WHERE stripe_charge_id IS NOT NULL;
      `);

      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_unique_refund_job
        ON app_receipts (job_id)
        WHERE job_id IS NOT NULL AND type = 'refund';
      `);

      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_stripe_checkout_session_id_unique
        ON app_receipts (stripe_checkout_session_id)
        WHERE stripe_checkout_session_id IS NOT NULL;
      `);

      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_stripe_invoice_id_unique
        ON app_receipts (stripe_invoice_id)
        WHERE stripe_invoice_id IS NOT NULL;
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_receipts_stripe_customer_id_idx
        ON app_receipts (stripe_customer_id)
        WHERE stripe_customer_id IS NOT NULL;
      `);

      await query(`
        -- legacy columns retained for Connect margin reporting; left NULL when RECEIPTS_PRICE_ONLY is enabled.
        ALTER TABLE app_receipts
        ADD COLUMN IF NOT EXISTS platform_revenue_cents BIGINT,
        ADD COLUMN IF NOT EXISTS destination_acct TEXT,
        ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
      `);

      const appReceiptsPublicViewSql = `
        CREATE OR REPLACE VIEW app_receipts_public AS
        SELECT
          id,
          user_id,
          type AS kind,
          amount_cents,
          currency,
          description,
          created_at,
          job_id,
          surface,
          billing_product_key,
          NULL::bigint AS tax_amount_cents,
          NULL::bigint AS discount_amount_cents
        FROM app_receipts;
      `;

      try {
        await query(appReceiptsPublicViewSql);
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
        if (code !== '42P16') {
          throw error;
        }

        await query(`
          DROP VIEW IF EXISTS app_receipts_public;
        `);

        try {
          await query(`
            CREATE VIEW app_receipts_public AS
            SELECT
              id,
              user_id,
              type AS kind,
              amount_cents,
              currency,
              description,
              created_at,
              job_id,
              surface,
              billing_product_key,
              NULL::bigint AS tax_amount_cents,
              NULL::bigint AS discount_amount_cents
            FROM app_receipts;
          `);
        } catch (createError) {
          const createCode =
            typeof createError === 'object' && createError && 'code' in createError
              ? (createError as { code?: string }).code
              : undefined;
          if (createCode !== '42P07') {
            throw createError;
          }
        }
      }

      await query(`
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          processed_at TIMESTAMPTZ
        );
      `);

      try {
        await query(`CREATE TYPE user_role AS ENUM ('admin', 'user');`);
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
        if (code !== '42710') {
          throw error;
        }
      }

      await query(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id UUID PRIMARY KEY,
          role user_role NOT NULL DEFAULT 'user',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id UUID PRIMARY KEY,
          default_share_public BOOLEAN NOT NULL DEFAULT TRUE,
          default_allow_index BOOLEAN NOT NULL DEFAULT TRUE,
          onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admin_audit (
          id BIGSERIAL PRIMARY KEY,
          admin_id UUID NOT NULL,
          target_user_id UUID,
          action TEXT NOT NULL,
          route TEXT,
          metadata JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS admin_audit_admin_idx ON admin_audit (admin_id, created_at DESC);
      `);

      await query(`
        ALTER TABLE IF EXISTS profiles
        ADD COLUMN IF NOT EXISTS preferred_currency TEXT CHECK (preferred_currency IN ('eur','usd','gbp','chf')),
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS synced_from_supabase BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
      `);

      try {
        await query(`
          CREATE INDEX IF NOT EXISTS profiles_preferred_currency_idx ON profiles (preferred_currency);
        `);
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
        if (code !== '42P01') {
          throw error;
        }
      }

      try {
        await query(`
          CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_unique
          ON profiles (stripe_customer_id)
          WHERE stripe_customer_id IS NOT NULL;
        `);
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
        if (code !== '42P01') {
          throw error;
        }
      }

      await query(`
        CREATE TABLE IF NOT EXISTS playlists (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          slug TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          is_public BOOLEAN NOT NULL DEFAULT TRUE,
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS playlist_items (
          playlist_id UUID NOT NULL,
          video_id TEXT NOT NULL,
          order_index INTEGER NOT NULL DEFAULT 0,
          pinned BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (playlist_id, video_id)
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS playlist_items_playlist_idx ON playlist_items (playlist_id, order_index);
      `);

      await query(`
        ALTER TABLE playlist_items
        ALTER COLUMN video_id TYPE TEXT USING video_id::text;
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS homepage_sections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT,
          subtitle TEXT,
          video_id TEXT,
          playlist_id UUID,
          order_index INTEGER NOT NULL DEFAULT 0,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          start_at TIMESTAMPTZ,
          end_at TIMESTAMPTZ,
          updated_by UUID,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS homepage_sections_active_idx ON homepage_sections (enabled, order_index);
      `);

      await query(`
        ALTER TABLE homepage_sections
        ALTER COLUMN video_id TYPE TEXT USING video_id::text;
      `);

      await query(
        `
          UPDATE app_jobs
          SET visibility = 'private',
              indexable = FALSE,
              legacy_migrated = TRUE
          WHERE legacy_migrated IS NOT TRUE
            AND created_at < $1::timestamptz;
        `,
        [FEATURE_LAUNCH_TIMESTAMP]
      );

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

      await query(`
        CREATE INDEX IF NOT EXISTS fal_queue_log_provider_job_created_idx
          ON fal_queue_log (provider_job_id, created_at DESC)
          WHERE provider_job_id IS NOT NULL;
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS app_generate_metrics (
          id BIGSERIAL PRIMARY KEY,
          job_id TEXT,
          user_id TEXT,
          engine_id TEXT NOT NULL,
          engine_label TEXT,
          mode TEXT,
          attempt_status TEXT NOT NULL,
          error_code TEXT,
          duration_ms INTEGER,
          payload JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_generate_metrics_engine_idx
          ON app_generate_metrics (engine_id, created_at DESC);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS app_generate_metrics_job_idx
          ON app_generate_metrics (job_id)
          WHERE job_id IS NOT NULL;
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

    await query(`
      CREATE INDEX IF NOT EXISTS user_assets_user_source_origin_idx
      ON user_assets (user_id, source, (metadata->>'originUrl'));
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS user_assets_user_source_sha_idx
      ON user_assets (user_id, source, (metadata->>'contentSha256'));
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
