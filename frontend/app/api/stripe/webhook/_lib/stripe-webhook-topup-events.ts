import Stripe from 'stripe';
import { buildTopupAttributionGa4Params } from '@/server/wallet-attribution';
import {
  chargeReceiptUrl,
  invoiceDocumentFields,
  normalizeStripeId,
  retrieveChargeReceiptUrl,
} from './stripe-webhook-documents';
import { recordStripeTopup } from './stripe-webhook-topup-persistence';

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
  const resolvedReceiptUrl = stripeReceiptUrl ?? (await retrieveChargeReceiptUrl(stripe, chargeId));
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

  await recordStripeTopup({
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
      first_wallet_topup: session.metadata.first_wallet_topup ?? null,
      ...buildTopupAttributionGa4Params(session.metadata),
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
  }, { receiptsPriceOnly });
}

export async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<void> {
  const { stripe, receiptsPriceOnly } = options;
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
    const stripeReceiptUrl = chargeReceiptUrl(intent.latest_charge) ?? (await retrieveChargeReceiptUrl(stripe, chargeId));
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

    await recordStripeTopup({
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
        first_wallet_topup: intent.metadata?.first_wallet_topup ?? null,
        ...buildTopupAttributionGa4Params(intent.metadata),
      },
      originalAmountCents: settlementAmountCents ?? amountCents,
      originalCurrency,
      fxRate,
      fxMarginBps,
      fxRateTimestamp,
      stripeCustomerId: normalizeStripeId(intent.customer),
      stripeReceiptUrl,
      ...invoiceDocumentFields(intent.invoice),
    }, { receiptsPriceOnly });
  }
}
