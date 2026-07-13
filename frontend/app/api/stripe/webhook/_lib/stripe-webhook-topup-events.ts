import Stripe from 'stripe';
import { buildTopupAttributionGa4Params } from '@/server/wallet-attribution';
import {
  chargeReceiptUrl,
  invoiceDocumentFields,
  normalizeStripeId,
  retrieveChargeReceiptUrl,
} from './stripe-webhook-documents';
import {
  recordStripeTopup,
  type CanonicalStripeTopupInput,
} from './stripe-webhook-topup-persistence';

export type CanonicalTopupBuildOptions = {
  receiptsPriceOnly: boolean;
  resolvedReceiptUrl: string | null;
};

export function buildCheckoutSessionTopupInput(
  session: Stripe.Checkout.Session,
  options: CanonicalTopupBuildOptions
): CanonicalStripeTopupInput | null {
  if (!session.metadata || session.metadata.kind !== 'topup') return null;
  const userId = session.metadata.user_id;
  if (!userId) return null;

  const amountCents = session.amount_total ?? null;
  if (!amountCents || amountCents <= 0) return null;

  const settlementCurrency = session.currency ?? 'usd';
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const chargeId = typeof session.payment_intent === 'object' && session.payment_intent && !Array.isArray(session.payment_intent)
    ? (typeof session.payment_intent.latest_charge === 'string'
        ? session.payment_intent.latest_charge
        : session.payment_intent.latest_charge?.id ?? null)
    : null;
  const platformRevenueCents = !options.receiptsPriceOnly
    ? session.metadata.platform_fee_cents_usd
      ? Number(session.metadata.platform_fee_cents_usd)
      : session.metadata.platform_fee_cents
        ? Number(session.metadata.platform_fee_cents)
        : undefined
    : undefined;
  const fxRate =
    session.metadata.fx_rate && Number.isFinite(Number(session.metadata.fx_rate))
      ? Number(session.metadata.fx_rate)
      : null;
  const fxMarginBps =
    session.metadata.fx_margin_bps && Number.isFinite(Number(session.metadata.fx_margin_bps))
      ? Number(session.metadata.fx_margin_bps)
      : null;

  return {
    userId,
    walletAmountCents: session.metadata.wallet_amount_cents
      ? Number(session.metadata.wallet_amount_cents)
      : amountCents,
    walletCurrency: session.metadata.wallet_currency ?? 'USD',
    settlementAmountCents: amountCents,
    settlementCurrency,
    paymentIntentId,
    chargeId,
    platformRevenueCents,
    destinationAcct: session.metadata.destination_account_id ?? undefined,
    metadata: {
      sessionId: session.id,
      source: 'checkout.session.completed',
      fx_rate: session.metadata.fx_rate ?? null,
      fx_source: session.metadata.fx_source ?? null,
      topup_tier_id: session.metadata.topup_tier_id ?? null,
      topup_tier_label: session.metadata.topup_tier_label ?? null,
      analytics_consent: session.metadata.analytics_consent ?? null,
      ga_client_id: session.metadata.ga_client_id ?? null,
      first_wallet_topup: session.metadata.first_wallet_topup ?? null,
      ...buildTopupAttributionGa4Params(session.metadata),
    },
    originalAmountCents: amountCents,
    originalCurrency: settlementCurrency,
    fxRate,
    fxMarginBps,
    fxRateTimestamp: session.metadata.rate_timestamp ?? null,
    stripeCustomerId: normalizeStripeId(session.customer),
    stripeCheckoutSessionId: session.id,
    stripeReceiptUrl: options.resolvedReceiptUrl,
    ...invoiceDocumentFields(session.invoice),
  };
}

export function buildPaymentIntentTopupInput(
  intent: Stripe.PaymentIntent,
  options: CanonicalTopupBuildOptions
): CanonicalStripeTopupInput | null {
  if (!intent.metadata || intent.metadata.kind !== 'topup') return null;
  const userId = intent.metadata.user_id;
  if (!userId) return null;

  const amountCents = intent.amount_received ?? intent.amount ?? null;
  if (!amountCents || amountCents <= 0) return null;

  const settlementCurrency = intent.currency ?? 'usd';
  const fxRate =
    intent.metadata.fx_rate && Number.isFinite(Number(intent.metadata.fx_rate))
      ? Number(intent.metadata.fx_rate)
      : null;
  const fxMarginBps =
    intent.metadata.fx_margin_bps && Number.isFinite(Number(intent.metadata.fx_margin_bps))
      ? Number(intent.metadata.fx_margin_bps)
      : null;

  return {
    userId,
    walletAmountCents: intent.metadata.wallet_amount_cents
      ? Number(intent.metadata.wallet_amount_cents)
      : amountCents,
    walletCurrency: intent.metadata.wallet_currency ?? 'USD',
    settlementAmountCents: amountCents,
    settlementCurrency,
    paymentIntentId: intent.id,
    chargeId: typeof intent.latest_charge === 'string'
      ? intent.latest_charge
      : intent.latest_charge?.id ?? null,
    platformRevenueCents: options.receiptsPriceOnly
      ? undefined
      : intent.metadata.platform_fee_cents_usd
        ? Number(intent.metadata.platform_fee_cents_usd)
        : intent.application_fee_amount ?? undefined,
    destinationAcct:
      intent.metadata.destination_account_id ??
      intent.metadata.vendor_account_id ??
      undefined,
    metadata: {
      source: 'payment_intent.succeeded',
      fx_rate: intent.metadata.fx_rate ?? null,
      fx_source: intent.metadata.fx_source ?? null,
      topup_tier_id: intent.metadata.topup_tier_id ?? null,
      topup_tier_label: intent.metadata.topup_tier_label ?? null,
      analytics_consent: intent.metadata.analytics_consent ?? null,
      ga_client_id: intent.metadata.ga_client_id ?? null,
      first_wallet_topup: intent.metadata.first_wallet_topup ?? null,
      ...buildTopupAttributionGa4Params(intent.metadata),
    },
    originalAmountCents: amountCents,
    originalCurrency: intent.metadata.target_currency ?? settlementCurrency,
    fxRate,
    fxMarginBps,
    fxRateTimestamp: intent.metadata.rate_timestamp ?? null,
    stripeCustomerId: normalizeStripeId(intent.customer),
    stripeReceiptUrl: options.resolvedReceiptUrl,
    ...invoiceDocumentFields(intent.invoice),
  };
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<void> {
  const { stripe, receiptsPriceOnly } = options;
  if (!session.metadata || session.metadata.kind !== 'topup') {
    return;
  }
  const userId = session.metadata.user_id;
  if (!userId) return;

  const chargeId = typeof session.payment_intent === 'object' && session.payment_intent && !Array.isArray(session.payment_intent)
    ? (typeof session.payment_intent.latest_charge === 'string'
        ? session.payment_intent.latest_charge
        : session.payment_intent.latest_charge?.id ?? null)
    : null;
  const stripeReceiptUrl =
    typeof session.payment_intent === 'object' && session.payment_intent && !Array.isArray(session.payment_intent)
      ? chargeReceiptUrl(session.payment_intent.latest_charge)
      : null;
  const resolvedReceiptUrl = stripeReceiptUrl ?? (await retrieveChargeReceiptUrl(stripe, chargeId));
  const input = buildCheckoutSessionTopupInput(session, { receiptsPriceOnly, resolvedReceiptUrl });
  if (!input) return;

  await recordStripeTopup(input, { receiptsPriceOnly });
}

export async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<void> {
  const { stripe, receiptsPriceOnly } = options;
  if (!intent.metadata) return;

  const kind = intent.metadata.kind ?? null;
  if (kind === 'topup') {
    const userId = intent.metadata.user_id;
    if (!userId) return;

    const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;
    const stripeReceiptUrl = chargeReceiptUrl(intent.latest_charge) ?? (await retrieveChargeReceiptUrl(stripe, chargeId));
    const input = buildPaymentIntentTopupInput(intent, {
      receiptsPriceOnly,
      resolvedReceiptUrl: stripeReceiptUrl,
    });
    if (!input) return;

    await recordStripeTopup(input, { receiptsPriceOnly });
  }
}
