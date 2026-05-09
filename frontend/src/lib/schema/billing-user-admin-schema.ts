import { query } from '@/lib/db';

export async function ensureBillingUserAdminSchema(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS checkout_attempts (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        mode TEXT NOT NULL CHECK (mode IN ('hosted','express_checkout')),
        outcome TEXT NOT NULL DEFAULT 'pending',
        captcha_required BOOLEAN NOT NULL DEFAULT FALSE,
        captcha_passed BOOLEAN NOT NULL DEFAULT FALSE,
        stripe_checkout_session_id TEXT,
        reason TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS checkout_attempts_user_created_idx
        ON checkout_attempts (user_id, created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS checkout_attempts_ip_created_idx
        ON checkout_attempts (ip_hash, created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS checkout_attempts_outcome_created_idx
        ON checkout_attempts (outcome, created_at DESC);
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS checkout_attempts_stripe_session_idx
        ON checkout_attempts (stripe_checkout_session_id)
        WHERE stripe_checkout_session_id IS NOT NULL;
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
}
