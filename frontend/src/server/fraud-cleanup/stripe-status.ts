import type Stripe from 'stripe';
import { coerceNumber } from './normalization';
import type { StripeFraudStatus } from './types';

function hasFraudDetails(charge: Stripe.Charge): boolean {
  const details = charge.fraud_details as Record<string, unknown> | null | undefined;
  if (!details) return false;
  return Boolean(details.user_report || details.stripe_report);
}

export function statusFromCharge(charge: Stripe.Charge): StripeFraudStatus {
  const reasons = new Set<string>();
  const amountRefunded = Math.max(0, coerceNumber(charge.amount_refunded));
  if (charge.refunded || amountRefunded > 0) reasons.add('charge_refunded');
  if (charge.disputed) reasons.add('charge_disputed');
  if (hasFraudDetails(charge)) reasons.add('radar_fraud_details');

  const outcome = charge.outcome as Stripe.Charge.Outcome | null | undefined;
  if (outcome?.risk_level === 'highest') {
    reasons.add('stripe_highest_risk');
  }

  const refunds = (charge.refunds?.data ?? []) as Stripe.Refund[];
  if (refunds.some((refund) => refund.reason === 'fraudulent')) {
    reasons.add('refund_reason_fraudulent');
  }

  const fraudMarked = Array.from(reasons).some((reason) =>
    ['charge_disputed', 'radar_fraud_details', 'stripe_highest_risk', 'refund_reason_fraudulent'].includes(reason)
  );

  return {
    refunded: charge.refunded || amountRefunded > 0,
    fraudMarked,
    refundedAmountCents: amountRefunded,
    reasons: Array.from(reasons),
  };
}

export async function resolveStripeStatus(
  stripe: Stripe,
  refs: {
    paymentIntentId?: string | null;
    chargeId?: string | null;
    checkoutSessionId?: string | null;
  }
): Promise<StripeFraudStatus> {
  let chargeId = refs.chargeId ?? null;

  if (!chargeId && refs.checkoutSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(refs.checkoutSessionId, {
        expand: ['payment_intent', 'payment_intent.latest_charge'],
      } as Stripe.Checkout.SessionRetrieveParams);
      const intent = session.payment_intent;
      if (typeof intent === 'object' && intent && 'latest_charge' in intent) {
        const latestCharge = intent.latest_charge;
        if (typeof latestCharge === 'string') chargeId = latestCharge;
        else if (latestCharge?.id) return statusFromCharge(latestCharge as Stripe.Charge);
      }
    } catch (error) {
      return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: [`stripe_session_lookup_failed:${error instanceof Error ? error.message : 'unknown'}`] };
    }
  }

  if (!chargeId && refs.paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(refs.paymentIntentId, {
        expand: ['latest_charge', 'latest_charge.refunds'],
      } as Stripe.PaymentIntentRetrieveParams);
      const latestCharge = intent.latest_charge;
      if (typeof latestCharge === 'string') chargeId = latestCharge;
      else if (latestCharge?.id) return statusFromCharge(latestCharge as Stripe.Charge);
    } catch (error) {
      return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: [`stripe_intent_lookup_failed:${error instanceof Error ? error.message : 'unknown'}`] };
    }
  }

  if (!chargeId) {
    return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: ['missing_charge_reference'] };
  }

  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ['refunds', 'dispute'],
    } as Stripe.ChargeRetrieveParams);
    return statusFromCharge(charge);
  } catch (error) {
    return { refunded: false, fraudMarked: false, refundedAmountCents: 0, reasons: [`stripe_charge_lookup_failed:${error instanceof Error ? error.message : 'unknown'}`] };
  }
}

export async function countFailedOrBlockedTopupAttempts(
  stripe: Stripe,
  userId: string,
  since: Date | undefined
): Promise<number> {
  const search = stripe.paymentIntents.search?.bind(stripe.paymentIntents);
  if (!search || !since) return 0;

  const escapedUserId = userId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const created = Math.floor(since.getTime() / 1000);

  try {
    const result = await search({
      query: `metadata['user_id']:'${escapedUserId}' AND metadata['kind']:'topup' AND created>${created}`,
      limit: 100,
    });

    return result.data.filter((intent) =>
      ['canceled', 'requires_payment_method'].includes(intent.status)
    ).length;
  } catch (error) {
    console.warn('[fraud-cleanup] failed to count Stripe failed attempts', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return 0;
  }
}
