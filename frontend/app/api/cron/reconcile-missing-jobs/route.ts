import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { query } from '@/lib/db';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

type ChargeRow = {
  id: number;
  user_id: string;
  job_id: string;
  amount_cents: number;
  currency: string | null;
  description: string | null;
  pricing_snapshot: unknown;
  surface: string | null;
  billing_product_key: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  created_at: string;
};

const isEnabled = (process.env.CRON_RECONCILE_ORPHANS_ENABLED ?? '').trim().toLowerCase() === 'true';
const minAgeMinutes = Math.max(5, Number.parseInt(process.env.CRON_RECONCILE_MIN_AGE_MINUTES ?? '25', 10) || 25);
const maxLookbackMinutesRaw = Number.parseInt(process.env.CRON_RECONCILE_MAX_LOOKBACK_MINUTES ?? '180', 10);
const maxLookbackMinutes = Math.max(minAgeMinutes + 1, Number.isFinite(maxLookbackMinutesRaw) ? maxLookbackMinutesRaw : 180);
const allowStripeRefunds = (process.env.CRON_RECONCILE_ALLOW_STRIPE_REFUNDS ?? '').trim().toLowerCase() === 'true';
const CRON_SECRET = (process.env.CRON_SECRET ?? '').trim();

function unauthorized(reason: string, req: NextRequest) {
  console.warn('[reconcile-orphans] unauthorized', {
    reason,
    cron: req.headers.get('x-vercel-cron') || null,
    ua: req.headers.get('user-agent') || null,
    deployment: req.headers.get('x-vercel-deployment-id') || null,
    source: req.headers.get('x-vercel-source') || null,
  });
  return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
}

function authorize(req: NextRequest): NextResponse | null {
  const auth = authorizeCronRequest(req.headers, {
    cronSecret: CRON_SECRET,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    overrideHeaderName: 'x-cron-key',
    vercelEnv: process.env.VERCEL,
  });
  if (!auth.ok) {
    return unauthorized(auth.reason, req);
  }
  return null;
}

async function issueStripeRefund(row: ChargeRow, stripe: Stripe): Promise<string | null> {
  const reference = row.stripe_payment_intent_id ?? row.stripe_charge_id;
  if (!reference) return null;
  try {
    const refund = await stripe.refunds.create(
      row.stripe_payment_intent_id
        ? { payment_intent: row.stripe_payment_intent_id }
        : { charge: row.stripe_charge_id! },
      { idempotencyKey: `orphan-job-refund-${row.job_id}` }
    );
    return refund?.id ?? null;
  } catch (error) {
    console.warn('[reconcile-orphans] stripe refund failed', { jobId: row.job_id, reference }, error);
    return null;
  }
}

async function recordRefund(row: ChargeRow, stripeRefundId: string | null) {
  const chargeDescription = row.description?.trim() || 'job reconciliation';
  const refundDescription = /^refund\b/i.test(chargeDescription) ? chargeDescription : `Refund ${chargeDescription}`;

  // Refund is recorded as a wallet credit; no platform revenue.
  await query(
    `INSERT INTO app_receipts (
       user_id, type, amount_cents, currency, description, job_id,
       surface, billing_product_key, pricing_snapshot, application_fee_cents, vendor_account_id,
       stripe_payment_intent_id, stripe_charge_id, stripe_refund_id,
       platform_revenue_cents, destination_acct, metadata
     )
     VALUES (
       $1,'refund',$2,$3,$4,$5,
       $6,$7,$8::jsonb,0,NULL,
       $9,$10,$11,
       0,NULL,$12::jsonb
     )
     ON CONFLICT DO NOTHING`,
    [
      row.user_id,
      row.amount_cents,
      row.currency ?? 'USD',
      refundDescription,
      row.job_id,
      row.surface,
      row.billing_product_key,
      row.pricing_snapshot ? JSON.stringify(row.pricing_snapshot) : null,
      row.stripe_payment_intent_id,
      row.stripe_charge_id,
      stripeRefundId,
      JSON.stringify({
        reason: 'orphan_job_missing',
        source: 'cron-reconcile',
        original_receipt_id: row.id,
      }),
    ]
  );
}

async function reconcile() {
  if (!isEnabled) {
    return NextResponse.json(
      { ok: false, refunded: 0, stripeRefunds: 0, disabled: true, reason: 'CRON_RECONCILE_ORPHANS_ENABLED is not true' },
      { status: 503 }
    );
  }

  // Find charges older than 25 minutes that have no matching job and no refund.
  const candidates = await query<ChargeRow>(
    `
      SELECT
        r.id,
        r.user_id,
        r.job_id,
        r.amount_cents,
        COALESCE(NULLIF(r.currency, ''), 'USD') AS currency,
        r.description,
        r.pricing_snapshot,
        r.surface,
        r.billing_product_key,
        r.stripe_payment_intent_id,
        r.stripe_charge_id,
        r.created_at
      FROM app_receipts r
      WHERE r.type = 'charge'
        AND r.job_id IS NOT NULL
        AND r.created_at < NOW() - ($1 * INTERVAL '1 minute')
        AND r.created_at >= NOW() - ($2 * INTERVAL '1 minute')
        AND NOT EXISTS (SELECT 1 FROM app_receipts rf WHERE rf.job_id = r.job_id AND rf.type = 'refund')
        AND NOT EXISTS (SELECT 1 FROM app_jobs j WHERE j.job_id = r.job_id)
        AND NOT EXISTS (SELECT 1 FROM fal_queue_log f WHERE f.job_id = r.job_id)
      ORDER BY r.created_at ASC
      LIMIT 50
    `,
    [minAgeMinutes, maxLookbackMinutes]
  );

  if (!candidates.length) {
    return NextResponse.json({ ok: true, refunded: 0, stripeRefunds: 0 });
  }

  const stripe =
    allowStripeRefunds && process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length
      ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
      : null;

  let refunded = 0;
  let stripeRefunds = 0;

  for (const row of candidates) {
    let stripeRefundId: string | null = null;
    if (stripe) {
      stripeRefundId = await issueStripeRefund(row, stripe);
      if (stripeRefundId) {
        stripeRefunds += 1;
      }
    }
    try {
      await recordRefund(row, stripeRefundId);
      refunded += 1;
    } catch (error) {
      console.warn('[reconcile-orphans] failed to record refund', { jobId: row.job_id, receiptId: row.id }, error);
    }
  }

  return NextResponse.json({
    ok: true,
    inspected: candidates.length,
    refunded,
    stripeRefunds,
    note: 'Charges with missing jobs after 25 minutes were refunded.',
  });
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (auth) return auth;
  return reconcile();
}

export async function POST(req: NextRequest) {
  const auth = authorize(req);
  if (auth) return auth;
  return reconcile();
}
