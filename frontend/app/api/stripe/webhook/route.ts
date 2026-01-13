import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV, isConnectPayments, receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureBillingSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { recordMockWalletTopUp } from '@/lib/wallet';
import { ensureUserPreferredCurrency, normalizeCurrencyCode } from '@/lib/currency';

const stripeSecret = ENV.STRIPE_SECRET_KEY;
const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export const runtime = 'nodejs';
const connectMode = isConnectPayments();
const receiptsPriceOnly = receiptsPriceOnlyEnabled();
const HANDLED_EVENT_TYPES = new Set(['checkout.session.completed', 'payment_intent.succeeded']);

export async function POST(request: NextRequest) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = Buffer.from(await request.arrayBuffer());
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe-webhook] Signature verification failed', error);
    return new NextResponse(`Webhook Error: ${(error as Error).message}`, { status: 400 });
  }

  try {
    if (!HANDLED_EVENT_TYPES.has(event.type)) {
      console.log('[stripe-webhook] Unhandled event type', event.type);
      return NextResponse.json({ received: true });
    }

    const shouldProcess = await beginStripeEvent(event);
    if (!shouldProcess) {
      console.log('[stripe-webhook] Skipping duplicate event', { eventId: event.id, type: event.type });
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSession(session);
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntent(intent);
        break;
      }
    }

    await markStripeEventProcessed(event.id);
  } catch (error) {
    await rollbackStripeEvent(event.id);
    console.error('[stripe-webhook] Handler error', error);
    return NextResponse.json({ error: 'Webhook handler failure' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function beginStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return true;
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[stripe-webhook] ensureBillingSchema failed for event idempotency', error);
    return true;
  }

  try {
    const rows = await query<{ event_id: string }>(
      `INSERT INTO stripe_webhook_events (event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.type]
    );
    return rows.length > 0;
  } catch (error) {
    console.warn('[stripe-webhook] Failed to record event id', { eventId: event.id, error });
    return true;
  }
}

async function markStripeEventProcessed(eventId: string) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await query(
      `UPDATE stripe_webhook_events
       SET processed_at = NOW()
       WHERE event_id = $1`,
      [eventId]
    );
  } catch (error) {
    console.warn('[stripe-webhook] Failed to mark event processed', { eventId, error });
  }
}

async function rollbackStripeEvent(eventId: string) {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await query(`DELETE FROM stripe_webhook_events WHERE event_id = $1`, [eventId]);
  } catch (error) {
    console.warn('[stripe-webhook] Failed to rollback event record', { eventId, error });
  }
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  if (!session.metadata || session.metadata.kind !== 'topup') {
    return;
  }
  const userId = session.metadata.user_id;
  if (!userId) return;

  const amountCents = session.amount_total ?? null;
  const currency = session.currency ?? 'usd';
  const walletAmountCents = session.metadata?.wallet_amount_cents ? Number(session.metadata.wallet_amount_cents) : amountCents;
  const walletCurrency = session.metadata?.wallet_currency ?? 'USD';
  const settlementAmountCents = amountCents;
  const settlementCurrency = currency;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  const chargeId = typeof session.payment_intent === 'object' && session.payment_intent && !Array.isArray(session.payment_intent)
    ? (typeof session.payment_intent.latest_charge === 'string'
        ? session.payment_intent.latest_charge
        : session.payment_intent.latest_charge?.id ?? null)
    : null;
  const platformRevenueCents = !receiptsPriceOnly
    ? session.metadata.platform_fee_cents_usd
      ? Number(session.metadata.platform_fee_cents_usd)
      : session.metadata.platform_fee_cents
        ? Number(session.metadata.platform_fee_cents)
        : undefined
    : undefined;
  const destinationAcct = connectMode ? session.metadata.destination_account_id ?? undefined : undefined;
  const fxRate =
    session.metadata.fx_rate && Number.isFinite(Number(session.metadata.fx_rate))
      ? Number(session.metadata.fx_rate)
      : null;
  const fxMarginBps =
    session.metadata.fx_margin_bps && Number.isFinite(Number(session.metadata.fx_margin_bps))
      ? Number(session.metadata.fx_margin_bps)
      : null;
  const fxRateTimestamp = session.metadata.rate_timestamp ?? null;

  if (!amountCents || amountCents <= 0) return;

  await recordTopup({
    userId,
    walletAmountCents: walletAmountCents ?? amountCents,
    walletCurrency,
    settlementAmountCents: settlementAmountCents ?? amountCents,
    settlementCurrency,
    paymentIntentId,
    chargeId,
    platformRevenueCents,
    destinationAcct,
    metadata: {
      sessionId: session.id,
      source: 'checkout.session.completed',
      fx_rate: session.metadata.fx_rate ?? null,
      fx_source: session.metadata.fx_source ?? null,
    },
    originalAmountCents: settlementAmountCents ?? amountCents,
    originalCurrency: settlementCurrency,
    fxRate,
    fxMarginBps,
    fxRateTimestamp,
  });
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  if (!intent.metadata) return;

  const kind = intent.metadata.kind ?? null;
  const destinationAcct =
    connectMode
      ? intent.metadata.destination_account_id ??
        intent.metadata.vendor_account_id ??
        null
      : null;

  if (kind === 'topup') {
    const userId = intent.metadata.user_id;
    if (!userId) return;

    const amountCents = intent.amount_received ?? intent.amount ?? null;
    const currency = intent.currency ?? 'usd';
    const walletAmountCents = intent.metadata?.wallet_amount_cents ? Number(intent.metadata.wallet_amount_cents) : amountCents;
    const walletCurrency = intent.metadata?.wallet_currency ?? 'USD';
    const settlementAmountCents = amountCents;
    const settlementCurrency = currency;
    const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
    const platformRevenueCents = receiptsPriceOnly
      ? undefined
      : intent.metadata?.platform_fee_cents_usd
        ? Number(intent.metadata.platform_fee_cents_usd)
        : intent.application_fee_amount ?? undefined;
    const vendorShareCents =
      amountCents !== null && platformRevenueCents !== undefined ? amountCents - platformRevenueCents : null;
    const fxRate =
      intent.metadata?.fx_rate && Number.isFinite(Number(intent.metadata.fx_rate))
        ? Number(intent.metadata.fx_rate)
        : null;
    const fxMarginBps =
      intent.metadata?.fx_margin_bps && Number.isFinite(Number(intent.metadata.fx_margin_bps))
        ? Number(intent.metadata.fx_margin_bps)
        : null;
    const fxRateTimestamp = intent.metadata?.rate_timestamp ?? null;
    const originalCurrency = intent.metadata?.target_currency ?? settlementCurrency;

    if (connectMode && destinationAcct && vendorShareCents && vendorShareCents !== 0) {
      await upsertVendorBalance({
        destinationAcct,
        currency: currency ?? 'usd',
        deltaCents: vendorShareCents,
      });
    }

    if (!amountCents || amountCents <= 0) return;

    await recordTopup({
      userId,
      walletAmountCents: walletAmountCents ?? amountCents,
      walletCurrency,
      settlementAmountCents: settlementAmountCents ?? amountCents,
      settlementCurrency,
      paymentIntentId: intent.id,
      chargeId,
      platformRevenueCents,
      destinationAcct: connectMode ? destinationAcct ?? undefined : undefined,
      metadata: {
        source: 'payment_intent.succeeded',
        fx_rate: intent.metadata?.fx_rate ?? null,
        fx_source: intent.metadata?.fx_source ?? null,
      },
      originalAmountCents: settlementAmountCents ?? amountCents,
      originalCurrency,
      fxRate,
      fxMarginBps,
      fxRateTimestamp,
    });
  } else if (connectMode && destinationAcct) {
    const totalCents = intent.amount_received ?? intent.amount ?? 0;
    const appFee = intent.application_fee_amount ?? 0;
    const vendorShare = totalCents - appFee;
    if (vendorShare !== 0) {
      await upsertVendorBalance({
        destinationAcct,
        currency: intent.currency ?? 'usd',
        deltaCents: vendorShare,
      });
    }
  }
}

async function recordTopup({
  userId,
  walletAmountCents,
  walletCurrency,
  settlementAmountCents,
  settlementCurrency,
  paymentIntentId,
  chargeId,
  platformRevenueCents,
  destinationAcct,
  metadata,
  originalAmountCents,
  originalCurrency,
  fxRate,
  fxMarginBps,
  fxRateTimestamp,
}: {
  userId: string;
  walletAmountCents: number;
  walletCurrency: string;
  settlementAmountCents: number | null;
  settlementCurrency: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  platformRevenueCents?: number | null | undefined;
  destinationAcct?: string | null | undefined;
  metadata?: Record<string, unknown>;
  originalAmountCents?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
  fxMarginBps?: number | null;
  fxRateTimestamp?: string | Date | null;
}) {
  const walletCurrencyUpper = walletCurrency ? walletCurrency.toUpperCase() : 'USD';
  const normalizedWalletAmount = Math.max(0, Math.round(walletAmountCents));
  const settlementCurrencyUpper = settlementCurrency ? settlementCurrency.toUpperCase() : walletCurrencyUpper;
  const normalizedSettlementAmount = settlementAmountCents != null ? Math.max(0, Math.round(settlementAmountCents)) : null;
  if (normalizedWalletAmount <= 0) return;

  if (!process.env.DATABASE_URL) {
    recordMockWalletTopUp(userId, normalizedWalletAmount, paymentIntentId, chargeId);
    console.log('[stripe-webhook] Recorded wallet top-up (mock)', {
      userId,
      amountCents: normalizedWalletAmount,
      currency: walletCurrencyUpper,
      paymentIntentId,
      chargeId,
    });
    return;
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[stripe-webhook] ensureBillingSchema failed, using mock ledger', error);
    recordMockWalletTopUp(userId, normalizedWalletAmount, paymentIntentId, chargeId);
    return;
  }

  try {
    if (paymentIntentId) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`,
        [paymentIntentId]
      );
      if (existing.length > 0) {
        return;
      }
    }

    if (chargeId) {
      const existingCharge = await query<{ id: string }>(
        `SELECT id FROM app_receipts WHERE stripe_charge_id = $1 LIMIT 1`,
        [chargeId]
      );
      if (existingCharge.length > 0) {
        return;
      }
    }

    const combinedMetadata = {
      ...(metadata ?? {}),
      wallet_amount_cents: normalizedWalletAmount,
      wallet_currency: walletCurrencyUpper,
      settlement_amount_cents: normalizedSettlementAmount,
      settlement_currency: settlementCurrencyUpper,
    };

    const rows = await query<{ id: number }>(
      `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, metadata, stripe_payment_intent_id, stripe_charge_id, platform_revenue_cents, destination_acct, original_amount_cents, original_currency, fx_rate, fx_margin_bps, fx_rate_timestamp)
       VALUES ($1, 'topup', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        userId,
        normalizedWalletAmount,
        walletCurrencyUpper,
        'Wallet top-up',
        combinedMetadata,
        paymentIntentId ?? null,
        chargeId ?? null,
        receiptsPriceOnly ? null : platformRevenueCents ?? null,
        connectMode ? destinationAcct ?? null : null,
        originalAmountCents ?? normalizedSettlementAmount ?? normalizedWalletAmount,
        originalCurrency ? originalCurrency.toUpperCase() : settlementCurrencyUpper,
        fxRate ?? null,
        fxMarginBps ?? null,
        fxRateTimestamp ? new Date(fxRateTimestamp) : null,
      ]
    );

    if (rows.length === 0) {
      console.log('[stripe-webhook] Skipped duplicate wallet top-up', {
        userId,
        amountCents: normalizedWalletAmount,
        currency: walletCurrencyUpper,
        paymentIntentId,
        chargeId,
      });
      return;
    }

    const resolvedCurrency = normalizeCurrencyCode(walletCurrencyUpper.toLowerCase());
    if (resolvedCurrency) {
      await ensureUserPreferredCurrency(userId, resolvedCurrency);
    }

    console.log('[stripe-webhook] Recorded wallet top-up', {
      userId,
      amountCents: normalizedWalletAmount,
      currency: walletCurrencyUpper,
      settlementAmountCents: normalizedSettlementAmount,
      settlementCurrency: settlementCurrencyUpper,
      paymentIntentId,
      chargeId,
      platformRevenueCents,
      destinationAcct,
    });
  } catch (error) {
    console.error('[stripe-webhook] Failed to persist top-up, using mock ledger', error);
    recordMockWalletTopUp(userId, normalizedWalletAmount, paymentIntentId, chargeId);
  }
}

async function upsertVendorBalance({
  destinationAcct,
  currency,
  deltaCents,
}: {
  destinationAcct: string;
  currency: string;
  deltaCents: number;
}) {
  if (!connectMode) {
    console.log('[stripe-webhook] Skipping vendor balance update (platform-only mode)', {
      destinationAcct,
      currency,
      deltaCents,
    });
    return;
  }
  if (!destinationAcct || !Number.isFinite(deltaCents) || deltaCents === 0) {
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log('[stripe-webhook] Skipping vendor balance update (no database)', {
      destinationAcct,
      currency,
      deltaCents,
    });
    return;
  }

  const normalizedCurrency = currency ? currency.toLowerCase() : 'usd';

  try {
    await ensureBillingSchema();
    await query(
      `INSERT INTO vendor_balances (destination_acct, currency, pending_cents)
       VALUES ($1, $2, $3)
       ON CONFLICT (destination_acct, currency)
       DO UPDATE SET pending_cents = vendor_balances.pending_cents + EXCLUDED.pending_cents,
                     updated_at = NOW()`,
      [destinationAcct, normalizedCurrency, deltaCents]
    );
  } catch (error) {
    console.error('[stripe-webhook] Failed to upsert vendor balance', {
      destinationAcct,
      currency: normalizedCurrency,
      deltaCents,
      error,
    });
  }
}
