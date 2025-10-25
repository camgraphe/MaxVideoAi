import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { isConnectPayments } from '@/lib/env';

export const dynamic = 'force-dynamic';

const stripeSecret = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

type VendorBalanceRow = {
  destination_acct: string;
  currency: string;
  pending_cents: string | number;
};

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

export async function POST(req: Request) {
  if (!isConnectPayments()) {
    return NextResponse.json({
      ok: true,
      results: [],
      status: 'disabled',
      mode: 'platform_only',
    });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('x-cron-key') !== cronSecret) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  const thresholdCents = Math.max(0, parseIntEnv('BATCH_TRANSFER_THRESHOLD_CENTS', 5000));
  const currency = (process.env.BATCH_TRANSFER_CURRENCY || 'usd').toLowerCase();
  const maxTransferCents = parseIntEnv('BATCH_TRANSFER_MAX_CENTS', 0);

  await ensureBillingSchema();

  const balances = await query<VendorBalanceRow>(
    `SELECT destination_acct, currency, pending_cents
     FROM vendor_balances
     WHERE currency = $1 AND pending_cents >= $2
     ORDER BY pending_cents DESC`,
    [currency, thresholdCents]
  );

  if (!balances.length) {
    return NextResponse.json({ ok: true, results: [], message: 'No balances met threshold' });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const row of balances) {
    const destination = row.destination_acct;
    const balanceCurrency = (row.currency || currency).toLowerCase();
    let pending = Number(row.pending_cents ?? 0);

    if (!destination || pending <= 0) {
      continue;
    }

    const processedTransfers: number[] = [];

    if (maxTransferCents > 0) {
      while (pending >= thresholdCents) {
        const amount = Math.min(pending, maxTransferCents);
        if (amount <= 0) break;
        processedTransfers.push(amount);
        pending -= amount;
        if (amount === pending) {
          pending = 0;
          break;
        }
      }
    } else {
      processedTransfers.push(pending);
      pending = 0;
    }

    for (const amount of processedTransfers) {
      const [batch] = await query<{ id: number }>(
        `INSERT INTO payout_batches (destination_acct, currency, amount_cents)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [destination, balanceCurrency, amount]
      );

      const batchId = batch?.id;
      if (!batchId) {
        results.push({
          destination,
          amount,
          ok: false,
          error: 'Failed to create payout batch record',
        });
        continue;
      }

      const idempotencyKey = `payout_batch_${batchId}`;

      try {
        const transfer = await stripe.transfers.create(
          {
            amount,
            currency: balanceCurrency,
            destination,
            description: 'Batched vendor payout',
          },
          { idempotencyKey }
        );

        await query(
          `UPDATE payout_batches
           SET stripe_transfer_id = $1,
               status = 'sent',
               sent_at = NOW()
           WHERE id = $2`,
          [transfer.id, batchId]
        );

        await query(
          `UPDATE vendor_balances
           SET pending_cents = GREATEST(pending_cents - $3, 0),
               updated_at = NOW()
           WHERE destination_acct = $1 AND currency = $2`,
          [destination, balanceCurrency, amount]
        );

        results.push({
          destination,
          amount,
          transfer: transfer.id,
          ok: true,
        });
      } catch (error) {
        const message = formatError(error);
        await query(
          `UPDATE payout_batches
           SET status = 'failed',
               error_message = $1
           WHERE id = $2`,
          [message, batchId]
        );
        results.push({
          destination,
          amount,
          ok: false,
          error: message,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
