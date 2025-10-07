import type { NextApiRequest, NextApiResponse } from 'next';
import { buffer } from 'micro';
import Stripe from 'stripe';
import { Pool } from 'pg';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const sig = req.headers['stripe-signature'];
    if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY || !sig) {
      return res.status(501).json({ error: 'Stripe webhook not configured' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const buf = await buffer(req);
    const event = stripe.webhooks.constructEvent(buf, sig as string, process.env.STRIPE_WEBHOOK_SECRET);

    // Lazy pool to avoid importing our ESM lib here
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.kind === 'topup' && session.payment_status === 'paid') {
          const userId = session.metadata.user_id;
          const amount = session.amount_total ?? 0; // in cents
          const currency = session.currency ?? 'usd';
          const insert = async () => {
            await pool!.query(
              `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, metadata)
               VALUES ($1,'topup',$2,$3,$4,$5)`,
              [userId, amount, currency.toUpperCase(), 'Wallet top-up', JSON.stringify({ session_id: session.id })]
            );
          };
          try {
            await insert();
          } catch (error) {
            // Auto-create receipts table on first run in dev
            if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '42P01') {
              await pool!.query(
                `CREATE TABLE IF NOT EXISTS app_receipts (
                  id bigserial primary key,
                  user_id text not null,
                  type text not null check (type in ('topup','charge','refund')),
                  amount_cents integer not null,
                  currency text not null default 'USD',
                  description text,
                  metadata jsonb,
                  job_id text,
                  pricing_snapshot jsonb,
                  application_fee_cents integer default 0,
                  vendor_account_id text,
                  stripe_payment_intent_id text,
                  stripe_charge_id text,
                  stripe_refund_id text,
                  created_at timestamptz not null default now()
                )`
              );
              await insert();
            } else {
              throw error;
            }
          }
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.kind !== 'run') {
          break;
        }

        const userId = intent.metadata.user_id;
        if (!userId) {
          break;
        }

        const jobId = typeof intent.metadata.job_id === 'string' ? intent.metadata.job_id : null;
        const amountCents = intent.amount_received ?? intent.amount ?? 0;
        const currency = (intent.currency ?? 'usd').toUpperCase();
        const applicationFeeCents = intent.application_fee_amount ?? 0;
        const vendorAccountId = intent.transfer_data?.destination ?? null;
        const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
        const description = intent.metadata.engine_label
          ? `Run ${intent.metadata.engine_label}${intent.metadata.duration_sec ? ` • ${intent.metadata.duration_sec}s` : ''}`
          : 'Direct run payment';

        let pricingSnapshot: unknown = null;
        if (typeof intent.metadata.pricing_snapshot === 'string' && intent.metadata.pricing_snapshot) {
          try {
            pricingSnapshot = JSON.parse(intent.metadata.pricing_snapshot);
          } catch {
            pricingSnapshot = null;
          }
        }

        if (!pricingSnapshot && jobId) {
          const jobRows = await pool!.query<{ pricing_snapshot: unknown }>(
            `SELECT pricing_snapshot FROM app_jobs WHERE job_id = $1 LIMIT 1`,
            [jobId]
          );
          if (jobRows.rows.length) {
            pricingSnapshot = jobRows.rows[0].pricing_snapshot;
          }
        }

        if (jobId) {
          await pool!.query(
            `UPDATE app_jobs
             SET payment_status = $1,
                 stripe_payment_intent_id = $2,
                 stripe_charge_id = COALESCE(stripe_charge_id, $3),
                 vendor_account_id = COALESCE(vendor_account_id, $4)
             WHERE job_id = $5`,
            ['paid_direct', intent.id, chargeId, vendorAccountId, jobId]
          );
        }

        const existing = await pool!.query<{ id: number }>(
          `SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`,
          [intent.id]
        );
        if (!existing.rows.length) {
          const pricingValue = pricingSnapshot == null
            ? null
            : typeof pricingSnapshot === 'string'
              ? pricingSnapshot
              : JSON.stringify(pricingSnapshot);
          await pool!.query(
            `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id)
             VALUES ($1,'charge',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
            [
              userId,
              amountCents,
              currency,
              description,
              jobId,
              pricingValue,
              applicationFeeCents,
              vendorAccountId,
              intent.id,
              chargeId,
            ]
          );
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        if (intent.metadata?.kind !== 'run') {
          break;
        }
        const jobId = typeof intent.metadata.job_id === 'string' ? intent.metadata.job_id : null;
        if (jobId) {
          await pool!.query(
            `UPDATE app_jobs SET payment_status = $1 WHERE job_id = $2`,
            ['failed_payment', jobId]
          );
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
        if (!paymentIntentId) {
          break;
        }

        const refunds = charge.refunds?.data ?? [];
        for (const refund of refunds) {
          if (!refund || !refund.id) continue;
          const existingRefund = await pool!.query<{ id: number }>(
            `SELECT id FROM app_receipts WHERE stripe_refund_id = $1 LIMIT 1`,
            [refund.id]
          );
          if (existingRefund.rows.length) {
            continue;
          }

          const receiptRows = await pool!.query<{ user_id: string; job_id: string | null; pricing_snapshot: unknown; vendor_account_id: string | null }>(
            `SELECT user_id, job_id, pricing_snapshot, vendor_account_id
             FROM app_receipts
             WHERE stripe_payment_intent_id = $1 AND type = 'charge'
             LIMIT 1`,
            [paymentIntentId]
          );

          let userId: string | null = null;
          let jobId: string | null = null;
          let snapshot: unknown = null;
          let vendorAccountId: string | null = null;

          if (receiptRows.rows.length) {
            userId = receiptRows.rows[0].user_id;
            jobId = receiptRows.rows[0].job_id;
            snapshot = receiptRows.rows[0].pricing_snapshot;
            vendorAccountId = receiptRows.rows[0].vendor_account_id;
          } else {
            const jobRows = await pool!.query<{ job_id: string; user_id: string | null; vendor_account_id: string | null; pricing_snapshot: unknown }>(
              `SELECT job_id, user_id, vendor_account_id, pricing_snapshot FROM app_jobs WHERE stripe_payment_intent_id = $1 LIMIT 1`,
              [paymentIntentId]
            );
            if (jobRows.rows.length) {
              const row = jobRows.rows[0];
              userId = row.user_id ?? userId;
              jobId = row.job_id ?? jobId;
              vendorAccountId = row.vendor_account_id ?? vendorAccountId;
              snapshot = row.pricing_snapshot ?? snapshot;
            }
          }

          if (!userId) {
            continue;
          }

          const pricingValue = snapshot == null
            ? null
            : typeof snapshot === 'string'
              ? snapshot
              : JSON.stringify(snapshot);

          await pool!.query(
            `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, stripe_refund_id)
             VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
            [
              userId,
              refund.amount ?? charge.amount_refunded ?? 0,
              (charge.currency ?? 'usd').toUpperCase(),
              refund.reason ? `Refund (${refund.reason})` : 'Refund',
              jobId,
              pricingValue,
              0,
              vendorAccountId ?? charge.transfer_data?.destination ?? null,
              paymentIntentId,
              charge.id ?? null,
              refund.id,
            ]
          );

          if (jobId) {
            await pool!.query(`UPDATE app_jobs SET payment_status = $1 WHERE job_id = $2`, ['refunded', jobId]);
          }
        }
        break;
      }
      default:
        // ignore others for now
        break;
    }

    await pool.end();
    return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Stripe webhook error', message);
    return res.status(400).json({ error: 'Webhook error' });
  }
}
