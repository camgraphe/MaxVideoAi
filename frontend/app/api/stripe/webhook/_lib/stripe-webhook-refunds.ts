import Stripe from 'stripe';
import { extractGaClientId, sendGa4Event } from '@/server/ga4';

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

async function resolveTopupTrackingMetadataFromCharge(
  charge: Stripe.Charge,
  stripe: Stripe
): Promise<TopupTrackingMetadata> {
  const fromCharge = parseTopupTrackingMetadata(charge.metadata);
  if (fromCharge.kind === 'topup') {
    return fromCharge;
  }
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) {
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

export async function handleChargeRefunded(event: Stripe.Event, stripe: Stripe): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const metadata = await resolveTopupTrackingMetadataFromCharge(charge, stripe);
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
