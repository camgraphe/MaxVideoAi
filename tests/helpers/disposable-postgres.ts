import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Pool } from 'pg';

export type DisposablePostgres = {
  pool: Pool;
  databaseUrl: string;
  cleanup(): Promise<void>;
};

function commandExists(command: string): boolean {
  return spawnSync('sh', ['-c', `command -v ${command}`], { encoding: 'utf8' }).status === 0;
}

function output(result: ReturnType<typeof spawnSync>): string {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
}

export function missingDisposablePostgresCommand(): string | null {
  return ['initdb', 'pg_ctl', 'psql'].find((command) => !commandExists(command)) ?? null;
}

export async function startDisposablePostgres(prefix: string): Promise<DisposablePostgres> {
  const temporaryRoot = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const dataDirectory = join(temporaryRoot, 'data');
  const socketDirectory = join(temporaryRoot, 'socket');
  mkdirSync(socketDirectory);
  const init = spawnSync('initdb', [
    '-A', 'trust', '-U', 'postgres', '-D', dataDirectory, '--no-locale', '--encoding=UTF8',
  ], { encoding: 'utf8' });
  if (init.status !== 0) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    throw new Error(`initdb failed: ${output(init)}`);
  }
  const start = spawnSync('pg_ctl', [
    '-D', dataDirectory,
    '-o', `-F -k ${socketDirectory} -c listen_addresses=''`,
    '-w',
    'start',
  ], { encoding: 'utf8', stdio: 'ignore' });
  if (start.status !== 0) {
    rmSync(temporaryRoot, { recursive: true, force: true });
    throw new Error('pg_ctl failed to start disposable PostgreSQL');
  }
  const pool = new Pool({ host: socketDirectory, user: 'postgres', database: 'postgres' });
  const databaseUrl = `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(socketDirectory)}`;
  return {
    pool,
    databaseUrl,
    async cleanup() {
      await pool.end().catch(() => undefined);
      spawnSync('pg_ctl', ['-D', dataDirectory, '-m', 'immediate', '-w', 'stop'], {
        encoding: 'utf8',
        stdio: 'ignore',
      });
      rmSync(temporaryRoot, { recursive: true, force: true });
    },
  };
}

export async function createPaidGenerationTestSchema(pool: Pool): Promise<void> {
  await pool.query(readFileSync('neon/migrations/30_mcp_paid_generation.sql', 'utf8'));
  await pool.query(`
    CREATE TABLE app_receipts (
      id bigserial PRIMARY KEY, user_id text NOT NULL, type text NOT NULL,
      amount_cents integer NOT NULL, currency text, description text, job_id text,
      surface text, billing_product_key text, pricing_snapshot jsonb,
      application_fee_cents integer, vendor_account_id text,
      stripe_payment_intent_id text, stripe_charge_id text, stripe_refund_id text,
      platform_revenue_cents integer, destination_acct text, metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE UNIQUE INDEX app_receipts_charge_job_unique
      ON app_receipts (job_id) WHERE type = 'charge';
    CREATE UNIQUE INDEX app_receipts_refund_job_unique
      ON app_receipts (job_id) WHERE type = 'refund';

    CREATE TABLE app_pricing_rules (
      id text PRIMARY KEY, engine_id text, mode text, resolution text,
      margin_percent numeric NOT NULL, margin_flat_cents integer NOT NULL,
      surcharge_audio_percent numeric NOT NULL, surcharge_upscale_percent numeric NOT NULL,
      currency text NOT NULL, compatibility_profile text, vendor_account_id text,
      effective_from timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_by text
    );
    INSERT INTO app_pricing_rules (
      id, margin_percent, margin_flat_cents, surcharge_audio_percent,
      surcharge_upscale_percent, currency, effective_from
    ) VALUES ('default', 0.2, 0, 0.2, 0.5, 'USD', clock_timestamp());

    CREATE TABLE user_account_restrictions (
      user_id text PRIMARY KEY, reason text NOT NULL, message text,
      active boolean NOT NULL DEFAULT true,
      restricted_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
    CREATE TABLE app_membership_tiers (
      tier text PRIMARY KEY, spend_threshold_cents integer NOT NULL,
      discount_percent numeric NOT NULL
    );
    INSERT INTO app_membership_tiers (tier, spend_threshold_cents, discount_percent) VALUES
      ('member', 0, 0), ('plus', 500000, 0.05), ('pro', 2000000, 0.10);

    CREATE TABLE app_jobs (
      id bigserial PRIMARY KEY, job_id text UNIQUE NOT NULL, user_id text, surface text,
      billing_product_key text, engine_id text, engine_label text, duration_sec integer,
      prompt text, thumb_url text, aspect_ratio text, has_audio boolean,
      can_upscale boolean, preview_frame text, batch_id text, group_id text,
      iteration_index integer, iteration_count integer, render_ids jsonb,
      hero_render_id text, local_key text, message text, eta_seconds integer,
      eta_label text, provider text, video_url text, preview_video_url text,
      audio_url text, status text, progress integer, provider_job_id text,
      final_price_cents integer, pricing_snapshot jsonb, cost_breakdown_usd jsonb,
      settings_snapshot jsonb, currency text, vendor_account_id text,
      payment_status text, stripe_payment_intent_id text, stripe_charge_id text,
      visibility text, indexable boolean, provisional boolean,
      hidden boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
    );
  `);
}
