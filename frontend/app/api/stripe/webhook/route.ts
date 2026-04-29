import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV, receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureBillingSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { recordMockWalletTopUp } from '@/lib/wallet';
import { ensureUserPreferredCurrency, normalizeCurrencyCode } from '@/lib/currency';
import { extractGaClientId, sendGa4Event } from '@/server/ga4';

const stripeSecret = ENV.STRIPE_SECRET_KEY;
const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export const runtime = 'nodejs';
const receiptsPriceOnly = receiptsPriceOnlyEnabled();
const HANDLED_EVENT_TYPES = new Set(['checkout.session.completed', 'payment_intent.succeeded', 'charge.refunded']);

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
      case 'charge.refunded': {
        await handleChargeRefunded(event);
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

type TopupTrackingMetadata = {
  kind: string | null;
  userId: string | null;
  analyticsConsentGranted: boolean;
  gaClientId: string | null;
  topupTierId: string | null;
  topupTierLabel: string | null;
  walletCurrency: string | null;
};

function minorToMajorAmount(amountMinor: number): number {
  return amountMinor / 100;
}

function readMetadataString(metadata: Stripe.Metadata | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseTopupTrackingMetadata(metadata: Stripe.Metadata | null | undefined): TopupTrackingMetadata {
  const consentValue = readMetadataString(metadata, 'analytics_consent') ?? '';
  return {
    kind: readMetadataString(metadata, 'kind'),
    userId: readMetadataString(metadata, 'user_id'),
    analyticsConsentGranted: consentValue.toLowerCase() === 'granted',
    gaClientId: extractGaClientId(readMetadataString(metadata, 'ga_client_id')),
    topupTierId: readMetadataString(metadata, 'topup_tier_id'),
    topupTierLabel: readMetadataString(metadata, 'topup_tier_label'),
    walletCurrency: readMetadataString(metadata, 'wallet_currency'),
  };
}

async function resolveTopupTrackingMetadataFromCharge(charge: Stripe.Charge): Promise<TopupTrackingMetadata> {
  const fromCharge = parseTopupTrackingMetadata(charge.metadata);
  if (fromCharge.kind === 'topup') {
    return fromCharge;
  }
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null;
  if (!paymentIntentId || !stripe) {
    return fromCharge;
  }
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const fromIntent = parseTopupTrackingMetadata(intent.metadata);
    return fromIntent.kind === 'topup' ? fromIntent : fromCharge;
  } catch (error) {
    console.warn('[stripe-webhook] failed to resolve refund metadata from payment intent', {
      paymentIntentId,
      error: error instanceof Error ? error.message : error,
    });
    return fromCharge;
  }
}

async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  const metadata = await resolveTopupTrackingMetadataFromCharge(charge);
  if (metadata.kind !== 'topup') {
    return;
  }
  if (!metadata.analyticsConsentGranted || !metadata.userId) {
    return;
  }

  const previous = (event.data.previous_attributes ?? {}) as { amount_refunded?: number };
  const previousAmountRefunded =
    typeof previous.amount_refunded === 'number' && Number.isFinite(previous.amount_refunded)
      ? previous.amount_refunded
      : null;
  const currentAmountRefunded =
    typeof charge.amount_refunded === 'number' && Number.isFinite(charge.amount_refunded)
      ? charge.amount_refunded
      : 0;
  const refundDeltaCents =
    previousAmountRefunded === null
      ? currentAmountRefunded
      : Math.max(0, currentAmountRefunded - previousAmountRefunded);

  if (refundDeltaCents <= 0) {
    return;
  }

  const currency = (charge.currency ?? metadata.walletCurrency ?? 'usd').toUpperCase();
  await sendGa4Event({
    name: 'topup_refunded',
    clientId: metadata.gaClientId,
    userId: metadata.userId,
    params: {
      value: minorToMajorAmount(refundDeltaCents),
      currency,
      refund_amount_major: minorToMajorAmount(refundDeltaCents),
      refund_amount_cents: refundDeltaCents,
      refunded_total_cents: currentAmountRefunded,
      wallet_currency: metadata.walletCurrency ?? undefined,
      payment_provider: 'stripe',
      stripe_charge_id: charge.id,
      stripe_payment_intent_id:
        typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? undefined,
      topup_tier_id: metadata.topupTierId ?? undefined,
      topup_tier_label: metadata.topupTierLabel ?? undefined,
    },
  });
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

type TopupDocumentFields = {
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  stripeHostedInvoiceUrl?: string | null;
  stripeInvoicePdf?: string | null;
  stripeReceiptUrl?: string | null;
};

function normalizeStripeId(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'object' && value && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }
  return null;
}

function normalizeStripeUrl(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : null;
}

function invoiceDocumentFields(invoice: string | Stripe.Invoice | null | undefined): TopupDocumentFields {
  if (!invoice) return {};
  if (typeof invoice === 'string') {
    return { stripeInvoiceId: normalizeStripeId(invoice) };
  }
  return {
    stripeInvoiceId: normalizeStripeId(invoice.id),
    stripeHostedInvoiceUrl: normalizeStripeUrl(invoice.hosted_invoice_url),
    stripeInvoicePdf: normalizeStripeUrl(invoice.invoice_pdf),
  };
}

function chargeReceiptUrl(charge: string | Stripe.Charge | null | undefined): string | null {
  if (!charge || typeof charge === 'string') return null;
  return normalizeStripeUrl(charge.receipt_url);
}

async function retrieveChargeReceiptUrl(chargeId: string | null): Promise<string | null> {
  if (!stripe || !chargeId) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    return normalizeStripeUrl(charge.receipt_url);
  } catch (error) {
    console.warn('[stripe-webhook] failed to retrieve charge receipt URL', {
      chargeId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
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
  const stripeReceiptUrl =
    typeof session.payment_intent === 'object' && session.payment_intent && !Array.isArray(session.payment_intent)
      ? chargeReceiptUrl(session.payment_intent.latest_charge)
      : null;
  const resolvedReceiptUrl = stripeReceiptUrl ?? (await retrieveChargeReceiptUrl(chargeId));
  const platformRevenueCents = !receiptsPriceOnly
    ? session.metadata.platform_fee_cents_usd
      ? Number(session.metadata.platform_fee_cents_usd)
      : session.metadata.platform_fee_cents
        ? Number(session.metadata.platform_fee_cents)
        : undefined
    : undefined;
  const destinationAcct = session.metadata.destination_account_id ?? undefined;
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
      topup_tier_id: session.metadata.topup_tier_id ?? null,
      topup_tier_label: session.metadata.topup_tier_label ?? null,
      analytics_consent: session.metadata.analytics_consent ?? null,
      ga_client_id: session.metadata.ga_client_id ?? null,
    },
    originalAmountCents: settlementAmountCents ?? amountCents,
    originalCurrency: settlementCurrency,
    fxRate,
    fxMarginBps,
    fxRateTimestamp,
    stripeCustomerId: normalizeStripeId(session.customer),
    stripeCheckoutSessionId: session.id,
    stripeReceiptUrl: resolvedReceiptUrl,
    ...invoiceDocumentFields(session.invoice),
  });
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  if (!intent.metadata) return;

  const kind = intent.metadata.kind ?? null;
  const destinationAcct =
    intent.metadata.destination_account_id ??
    intent.metadata.vendor_account_id ??
    null;

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
    const stripeReceiptUrl = chargeReceiptUrl(intent.latest_charge) ?? (await retrieveChargeReceiptUrl(chargeId));
    const platformRevenueCents = receiptsPriceOnly
      ? undefined
      : intent.metadata?.platform_fee_cents_usd
        ? Number(intent.metadata.platform_fee_cents_usd)
        : intent.application_fee_amount ?? undefined;
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
      destinationAcct: destinationAcct ?? undefined,
      metadata: {
        source: 'payment_intent.succeeded',
        fx_rate: intent.metadata?.fx_rate ?? null,
        fx_source: intent.metadata?.fx_source ?? null,
        topup_tier_id: intent.metadata?.topup_tier_id ?? null,
        topup_tier_label: intent.metadata?.topup_tier_label ?? null,
        analytics_consent: intent.metadata?.analytics_consent ?? null,
        ga_client_id: intent.metadata?.ga_client_id ?? null,
      },
      originalAmountCents: settlementAmountCents ?? amountCents,
      originalCurrency,
      fxRate,
      fxMarginBps,
      fxRateTimestamp,
      stripeCustomerId: normalizeStripeId(intent.customer),
      stripeReceiptUrl,
      ...invoiceDocumentFields(intent.invoice),
    });
  }
}

async function updateTopupDocumentFields(
  receiptId: string | number,
  fields: TopupDocumentFields & {
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
  }
) {
  const values = {
    stripePaymentIntentId: normalizeStripeId(fields.stripePaymentIntentId),
    stripeChargeId: normalizeStripeId(fields.stripeChargeId),
    stripeCustomerId: normalizeStripeId(fields.stripeCustomerId),
    stripeCheckoutSessionId: normalizeStripeId(fields.stripeCheckoutSessionId),
    stripeInvoiceId: normalizeStripeId(fields.stripeInvoiceId),
    stripeHostedInvoiceUrl: normalizeStripeUrl(fields.stripeHostedInvoiceUrl),
    stripeInvoicePdf: normalizeStripeUrl(fields.stripeInvoicePdf),
    stripeReceiptUrl: normalizeStripeUrl(fields.stripeReceiptUrl),
  };
  const hasDocumentValue = Object.values(values).some(Boolean);
  if (!hasDocumentValue) return;

  await query(
    `UPDATE app_receipts
     SET stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $2),
         stripe_charge_id = COALESCE(stripe_charge_id, $3),
         stripe_customer_id = COALESCE(stripe_customer_id, $4),
         stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $5),
         stripe_invoice_id = COALESCE(stripe_invoice_id, $6),
         stripe_hosted_invoice_url = COALESCE(stripe_hosted_invoice_url, $7),
         stripe_invoice_pdf = COALESCE(stripe_invoice_pdf, $8),
         stripe_receipt_url = COALESCE(stripe_receipt_url, $9),
         stripe_document_synced_at = NOW()
     WHERE id = $1`,
    [
      receiptId,
      values.stripePaymentIntentId,
      values.stripeChargeId,
      values.stripeCustomerId,
      values.stripeCheckoutSessionId,
      values.stripeInvoiceId,
      values.stripeHostedInvoiceUrl,
      values.stripeInvoicePdf,
      values.stripeReceiptUrl,
    ]
  );
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
  stripeCustomerId,
  stripeCheckoutSessionId,
  stripeInvoiceId,
  stripeHostedInvoiceUrl,
  stripeInvoicePdf,
  stripeReceiptUrl,
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
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  stripeHostedInvoiceUrl?: string | null;
  stripeInvoicePdf?: string | null;
  stripeReceiptUrl?: string | null;
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
    const documentFields = {
      stripePaymentIntentId: paymentIntentId ?? null,
      stripeChargeId: chargeId ?? null,
      stripeCustomerId: stripeCustomerId ?? null,
      stripeCheckoutSessionId: stripeCheckoutSessionId ?? null,
      stripeInvoiceId: stripeInvoiceId ?? null,
      stripeHostedInvoiceUrl: stripeHostedInvoiceUrl ?? null,
      stripeInvoicePdf: stripeInvoicePdf ?? null,
      stripeReceiptUrl: stripeReceiptUrl ?? null,
    };

    if (paymentIntentId) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`,
        [paymentIntentId]
      );
      if (existing.length > 0) {
        await updateTopupDocumentFields(existing[0].id, documentFields);
        return;
      }
    }

    if (chargeId) {
      const existingCharge = await query<{ id: string }>(
        `SELECT id FROM app_receipts WHERE stripe_charge_id = $1 LIMIT 1`,
        [chargeId]
      );
      if (existingCharge.length > 0) {
        await updateTopupDocumentFields(existingCharge[0].id, documentFields);
        return;
      }
    }

    if (stripeCheckoutSessionId) {
      const existingSession = await query<{ id: string }>(
        `SELECT id FROM app_receipts WHERE stripe_checkout_session_id = $1 LIMIT 1`,
        [stripeCheckoutSessionId]
      );
      if (existingSession.length > 0) {
        await updateTopupDocumentFields(existingSession[0].id, documentFields);
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
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         metadata,
         stripe_payment_intent_id,
         stripe_charge_id,
         platform_revenue_cents,
         destination_acct,
         original_amount_cents,
         original_currency,
         fx_rate,
         fx_margin_bps,
         fx_rate_timestamp,
         stripe_customer_id,
         stripe_checkout_session_id,
         stripe_invoice_id,
         stripe_hosted_invoice_url,
         stripe_invoice_pdf,
         stripe_receipt_url,
         stripe_document_synced_at
       )
       VALUES ($1, 'topup', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CASE WHEN $15::text IS NOT NULL OR $16::text IS NOT NULL OR $17::text IS NOT NULL OR $18::text IS NOT NULL OR $19::text IS NOT NULL OR $20::text IS NOT NULL THEN NOW() ELSE NULL END)
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
        destinationAcct ?? null,
        originalAmountCents ?? normalizedSettlementAmount ?? normalizedWalletAmount,
        originalCurrency ? originalCurrency.toUpperCase() : settlementCurrencyUpper,
        fxRate ?? null,
        fxMarginBps ?? null,
        fxRateTimestamp ? new Date(fxRateTimestamp) : null,
        documentFields.stripeCustomerId,
        documentFields.stripeCheckoutSessionId,
        documentFields.stripeInvoiceId,
        documentFields.stripeHostedInvoiceUrl,
        documentFields.stripeInvoicePdf,
        documentFields.stripeReceiptUrl,
      ]
    );

    if (rows.length === 0) {
      const fallbackExisting = paymentIntentId
        ? await query<{ id: string }>(`SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`, [
            paymentIntentId,
          ])
        : chargeId
          ? await query<{ id: string }>(`SELECT id FROM app_receipts WHERE stripe_charge_id = $1 LIMIT 1`, [chargeId])
          : stripeCheckoutSessionId
            ? await query<{ id: string }>(
                `SELECT id FROM app_receipts WHERE stripe_checkout_session_id = $1 LIMIT 1`,
                [stripeCheckoutSessionId]
              )
            : [];
      if (fallbackExisting.length > 0) {
        await updateTopupDocumentFields(fallbackExisting[0].id, documentFields);
      }
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

    const metadataRecord = combinedMetadata as Record<string, unknown>;
    const consentValue = typeof metadataRecord.analytics_consent === 'string' ? metadataRecord.analytics_consent : '';
    const analyticsConsentGranted = consentValue.toLowerCase() === 'granted';
    if (analyticsConsentGranted) {
      const gaClientId = extractGaClientId(
        typeof metadataRecord.ga_client_id === 'string' ? metadataRecord.ga_client_id : null
      );
      const sourceEvent = typeof metadataRecord.source === 'string' ? metadataRecord.source : null;
      const topupTierId = typeof metadataRecord.topup_tier_id === 'string' ? metadataRecord.topup_tier_id : null;
      const topupTierLabel =
        typeof metadataRecord.topup_tier_label === 'string' ? metadataRecord.topup_tier_label : null;
      const fxSource = typeof metadataRecord.fx_source === 'string' ? metadataRecord.fx_source : null;
      const transactionId = paymentIntentId ?? chargeId ?? `topup_${rows[0].id}`;
      const purchaseValueMinor = normalizedSettlementAmount ?? normalizedWalletAmount;
      const purchaseCurrency = settlementCurrencyUpper;
      const commonParams = {
        value: minorToMajorAmount(purchaseValueMinor),
        currency: purchaseCurrency,
        wallet_currency: walletCurrencyUpper,
        wallet_amount_usd: minorToMajorAmount(normalizedWalletAmount),
        wallet_amount_cents: normalizedWalletAmount,
        credits_amount: minorToMajorAmount(normalizedWalletAmount),
        topup_amount_usd: normalizedWalletAmount / 100,
        topup_amount_cents: normalizedWalletAmount,
        settlement_amount_minor: purchaseValueMinor,
        settlement_currency: settlementCurrencyUpper,
        payment_provider: 'stripe',
        payment_flow: 'checkout',
        source_event: sourceEvent ?? undefined,
        stripe_payment_intent_id: paymentIntentId ?? undefined,
        stripe_charge_id: chargeId ?? undefined,
        topup_tier_id: topupTierId ?? undefined,
        topup_tier_label: topupTierLabel ?? undefined,
        fx_source: fxSource ?? undefined,
        transaction_id: transactionId,
      };

      await Promise.allSettled([
        sendGa4Event({
          name: 'topup_completed',
          clientId: gaClientId,
          userId,
          params: commonParams,
        }),
        sendGa4Event({
          name: 'purchase',
          clientId: gaClientId,
          userId,
          params: {
            ...commonParams,
            item_category: 'wallet_topup',
          },
        }),
      ]);
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
