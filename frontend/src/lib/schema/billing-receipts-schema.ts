import { query } from '@/lib/db';

export async function ensureBillingReceiptsSchema(): Promise<void> {
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
}
