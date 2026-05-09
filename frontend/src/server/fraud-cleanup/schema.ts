import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { FRAUD_REVERSAL_REASON, RESTRICTED_ACCOUNT_MESSAGE } from './constants';

export async function ensureFraudCleanupSchema(): Promise<void> {
  await ensureBillingSchema();

  await query(`
    CREATE TABLE IF NOT EXISTS user_account_restrictions (
      user_id TEXT PRIMARY KEY,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      reason TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '${RESTRICTED_ACCOUNT_MESSAGE.replace(/'/g, "''")}',
      restricted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      restricted_by TEXT,
      lifted_at TIMESTAMPTZ,
      lifted_by TEXT,
      metadata JSONB
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS user_account_restrictions_active_idx
    ON user_account_restrictions (active, restricted_at DESC);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wallet_fraud_cleanup_audit (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT,
      stripe_payment_intent_id TEXT,
      stripe_checkout_session_id TEXT,
      stripe_charge_id TEXT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
      currency TEXT NOT NULL DEFAULT 'USD',
      previous_balance_cents INTEGER NOT NULL CHECK (previous_balance_cents >= 0),
      new_balance_cents INTEGER NOT NULL CHECK (new_balance_cents >= 0),
      action_taken TEXT NOT NULL CHECK (action_taken IN ('credits_reversed','account_restricted')),
      admin_user_id TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS wallet_fraud_cleanup_audit_user_created_idx
    ON wallet_fraud_cleanup_audit (user_id, created_at DESC);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS app_receipts_fraud_reversal_original_topup_unique
    ON app_receipts ((metadata ->> 'original_topup_receipt_id'))
    WHERE type = 'charge'
      AND metadata ->> 'reason' = '${FRAUD_REVERSAL_REASON}';
  `);
}
