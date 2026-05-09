import { query } from '@/lib/db';

export async function ensureBillingProviderSchema(): Promise<void> {
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
}
