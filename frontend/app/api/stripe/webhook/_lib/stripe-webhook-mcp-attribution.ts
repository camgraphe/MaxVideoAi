import type Stripe from 'stripe';

import { query, type QueryExecutor } from '@/lib/db';
import {
  recordConfirmedMcpWalletFunding,
  resolveMcpTrialToWalletWindowSeconds,
} from '@/server/agent-api/mcp-funnel';
import { normalizeStripeId } from './stripe-webhook-documents';

type CanonicalTopupReceiptRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  created_at: Date | string;
};

type ReceiptIdentities = {
  paymentIntentId: string | null;
  chargeId: string | null;
  checkoutSessionId: string | null;
  invoiceId: string | null;
};

type ReplayOptions = {
  executor?: QueryExecutor;
  conversionWindowSeconds?: number;
};

function successfulTopupReceiptIdentities(event: Stripe.Event): ReceiptIdentities | null {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind !== 'topup') return null;
    const paymentIntent = session.payment_intent;
    return {
      paymentIntentId: normalizeStripeId(paymentIntent),
      chargeId: typeof paymentIntent === 'object' && paymentIntent
        ? normalizeStripeId(paymentIntent.latest_charge)
        : null,
      checkoutSessionId: normalizeStripeId(session.id),
      invoiceId: normalizeStripeId(session.invoice),
    };
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.kind !== 'topup') return null;
    return {
      paymentIntentId: normalizeStripeId(intent.id),
      chargeId: normalizeStripeId(intent.latest_charge),
      checkoutSessionId: null,
      invoiceId: normalizeStripeId(intent.invoice),
    };
  }

  return null;
}

/**
 * Replays only MCP measurement from an already-committed canonical receipt.
 * It never inserts or updates a wallet receipt and never calls Stripe.
 */
export async function replayMcpTopupAttributionForProcessedEvent(
  event: Stripe.Event,
  options: ReplayOptions = {},
): Promise<boolean> {
  const identities = successfulTopupReceiptIdentities(event);
  if (!identities || !Object.values(identities).some(Boolean)) return false;

  const executor = options.executor ?? { query };
  const conversionWindowSeconds = options.conversionWindowSeconds
    ?? resolveMcpTrialToWalletWindowSeconds();
  try {
    const rows = await executor.query<CanonicalTopupReceiptRow>(
      `SELECT id::text AS id, user_id, amount_cents, currency, created_at
         FROM app_receipts
        WHERE type = 'topup'
          AND (
            ($1::text IS NOT NULL AND stripe_payment_intent_id = $1)
            OR ($2::text IS NOT NULL AND stripe_charge_id = $2)
            OR ($3::text IS NOT NULL AND stripe_checkout_session_id = $3)
            OR ($4::text IS NOT NULL AND stripe_invoice_id = $4)
          )
        ORDER BY id ASC
        LIMIT 1`,
      [
        identities.paymentIntentId,
        identities.chargeId,
        identities.checkoutSessionId,
        identities.invoiceId,
      ],
    );
    const receipt = rows[0];
    if (!receipt) return false;
    const occurredAt = receipt.created_at instanceof Date
      ? receipt.created_at
      : new Date(receipt.created_at);
    return recordConfirmedMcpWalletFunding({
      receiptId: receipt.id,
      userId: receipt.user_id,
      amountCents: receipt.amount_cents,
      currency: receipt.currency,
      occurredAt,
    }, { executor, conversionWindowSeconds });
  } catch {
    return false;
  }
}
