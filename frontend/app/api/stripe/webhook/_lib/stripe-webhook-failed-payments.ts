import Stripe from 'stripe';
import { query } from '@/lib/db';

type FailedTopupPaymentMetadata = {
  kind: string | null;
  userId: string | null;
  checkoutAttemptId: number | null;
  firstWalletTopup: boolean;
  checkoutUiMode: string | null;
};

const FAILED_CARD_ATTEMPT_LIMIT = 5;
const FAILED_CARD_ATTEMPT_LIMIT_REASON = 'failed_card_attempt_limit';

function readMetadataString(metadata: Stripe.Metadata | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readMetadataBoolean(metadata: Stripe.Metadata | null | undefined, key: string): boolean {
  return (readMetadataString(metadata, key) ?? '').toLowerCase() === 'true';
}

function readMetadataPositiveInteger(metadata: Stripe.Metadata | null | undefined, key: string): number | null {
  const value = readMetadataString(metadata, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function parseFailedTopupPaymentMetadata(metadata: Stripe.Metadata | null | undefined): FailedTopupPaymentMetadata {
  return {
    kind: readMetadataString(metadata, 'kind'),
    userId: readMetadataString(metadata, 'user_id'),
    checkoutAttemptId: readMetadataPositiveInteger(metadata, 'checkout_attempt_id'),
    firstWalletTopup: readMetadataBoolean(metadata, 'first_wallet_topup'),
    checkoutUiMode: readMetadataString(metadata, 'checkout_ui_mode'),
  };
}

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

async function resolveFailedTopupMetadataFromCharge(
  charge: Stripe.Charge,
  stripe: Stripe
): Promise<{ intent: Stripe.PaymentIntent | null; metadata: FailedTopupPaymentMetadata }> {
  const fromCharge = parseFailedTopupPaymentMetadata(charge.metadata);
  const paymentIntentId = normalizeStripeId(charge.payment_intent);
  if (!paymentIntentId) {
    return { intent: null, metadata: fromCharge };
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const fromIntent = parseFailedTopupPaymentMetadata(intent.metadata);
    return {
      intent,
      metadata: fromIntent.kind === 'topup' ? fromIntent : fromCharge,
    };
  } catch (error) {
    console.warn('[stripe-webhook] failed to resolve failed-charge payment intent metadata', {
      paymentIntentId,
      error: error instanceof Error ? error.message : error,
    });
    return { intent: null, metadata: fromCharge };
  }
}

export async function handleChargeFailed(event: Stripe.Event, stripe: Stripe): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const charge = event.data.object as Stripe.Charge;
  if (charge.status !== 'failed') return;

  const { intent, metadata } = await resolveFailedTopupMetadataFromCharge(charge, stripe);
  if (metadata.kind !== 'topup' || !metadata.userId || !metadata.checkoutAttemptId || !metadata.firstWalletTopup) {
    return;
  }

  const paymentIntentId = normalizeStripeId(charge.payment_intent);
  const failureCount = await recordCheckoutFailedCardAttempt({
    amountCents: charge.amount,
    charge,
    chargeId: charge.id,
    checkoutAttemptId: metadata.checkoutAttemptId,
    checkoutUiMode: metadata.checkoutUiMode,
    intent,
    paymentIntentId,
    sourceEvent: 'charge.failed',
    userId: metadata.userId,
  });

  if (failureCount >= FAILED_CARD_ATTEMPT_LIMIT) {
    await expireCheckoutSessionForFailedCards(
      {
        chargeId: charge.id,
        checkoutAttemptId: metadata.checkoutAttemptId,
        failureCount,
        paymentIntentId,
        userId: metadata.userId,
      },
      stripe
    );
  }
}

export async function handlePaymentIntentFailed(event: Stripe.Event, stripe: Stripe): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const intent = event.data.object as Stripe.PaymentIntent;
  const metadata = parseFailedTopupPaymentMetadata(intent.metadata);
  if (metadata.kind !== 'topup' || !metadata.userId || !metadata.checkoutAttemptId || !metadata.firstWalletTopup) {
    return;
  }

  const chargeId = normalizeStripeId(intent.latest_charge);
  const charge = chargeId ? await retrieveFailedCharge(chargeId, stripe) : null;
  const failureCount = await recordCheckoutFailedCardAttempt({
    amountCents: charge?.amount ?? intent.amount,
    charge,
    chargeId,
    checkoutAttemptId: metadata.checkoutAttemptId,
    checkoutUiMode: metadata.checkoutUiMode,
    intent,
    paymentIntentId: intent.id,
    sourceEvent: 'payment_intent.payment_failed',
    userId: metadata.userId,
  });

  if (failureCount >= FAILED_CARD_ATTEMPT_LIMIT) {
    await expireCheckoutSessionForFailedCards(
      {
        chargeId,
        checkoutAttemptId: metadata.checkoutAttemptId,
        failureCount,
        paymentIntentId: intent.id,
        userId: metadata.userId,
      },
      stripe
    );
  }
}

async function retrieveFailedCharge(chargeId: string, stripe: Stripe): Promise<Stripe.Charge | null> {
  try {
    return await stripe.charges.retrieve(chargeId);
  } catch (error) {
    console.warn('[stripe-webhook] failed to retrieve failed charge', {
      chargeId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

async function recordCheckoutFailedCardAttempt({
  amountCents,
  charge,
  chargeId,
  checkoutAttemptId,
  checkoutUiMode,
  intent,
  paymentIntentId,
  sourceEvent,
  userId,
}: {
  amountCents: number;
  charge: Stripe.Charge | null;
  chargeId: string | null;
  checkoutAttemptId: number;
  checkoutUiMode: string | null;
  intent: Stripe.PaymentIntent | null;
  paymentIntentId: string | null;
  sourceEvent: 'charge.failed' | 'payment_intent.payment_failed';
  userId: string;
}): Promise<number> {
  if (chargeId) {
    const duplicateRows = await query<{ duplicate_count: number | string }>(
      `SELECT COUNT(*)::int AS duplicate_count
         FROM checkout_interaction_events
        WHERE checkout_attempt_id = $1
          AND event_name = 'stripe_charge_failed'
          AND metadata->>'stripe_charge_id' = $2`,
      [checkoutAttemptId, chargeId]
    );
    if (Number(duplicateRows[0]?.duplicate_count ?? 0) > 0) {
      return countCheckoutFailedCardAttempts(checkoutAttemptId);
    }
  }

  const cardDetails = charge?.payment_method_details?.card;
  await query(
    `INSERT INTO checkout_interaction_events (
       checkout_attempt_id,
       user_id,
       stripe_checkout_session_id,
       event_name,
       mode,
       amount_cents,
       metadata
     )
     VALUES ($1, $2, NULL, 'stripe_charge_failed', $3, $4, $5::jsonb)`,
    [
      checkoutAttemptId,
      userId,
      checkoutUiMode === 'elements' ? 'express_checkout' : 'hosted',
      amountCents,
      JSON.stringify({
        stripe_charge_id: chargeId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: normalizeStripeId(charge?.customer ?? intent?.customer),
        stripe_event_source: sourceEvent,
        failure_code: charge?.failure_code ?? intent?.last_payment_error?.code ?? null,
        failure_message: charge?.failure_message ?? intent?.last_payment_error?.message ?? null,
        decline_code: intent?.last_payment_error?.decline_code ?? null,
        outcome_reason: charge?.outcome?.reason ?? null,
        risk_level: charge?.outcome?.risk_level ?? null,
        card_brand: cardDetails?.brand ?? null,
        card_country: cardDetails?.country ?? null,
        failed_card_attempt_limit: FAILED_CARD_ATTEMPT_LIMIT,
      }),
    ]
  );

  return countCheckoutFailedCardAttempts(checkoutAttemptId);
}

async function countCheckoutFailedCardAttempts(checkoutAttemptId: number): Promise<number> {
  const rows = await query<{ failed_count: number | string }>(
    `SELECT COUNT(*)::int AS failed_count
       FROM checkout_interaction_events
      WHERE checkout_attempt_id = $1
        AND event_name = 'stripe_charge_failed'`,
    [checkoutAttemptId]
  );
  return Number(rows[0]?.failed_count ?? 0);
}

async function expireCheckoutSessionForFailedCards(
  {
    chargeId,
    checkoutAttemptId,
    failureCount,
    paymentIntentId,
    userId,
  }: {
    chargeId: string | null;
    checkoutAttemptId: number;
    failureCount: number;
    paymentIntentId: string | null;
    userId: string;
  },
  stripe: Stripe
): Promise<void> {
  const attemptRows = await query<{
    outcome: string | null;
    reason: string | null;
    stripe_checkout_session_id: string | null;
  }>(
    `SELECT outcome, reason, stripe_checkout_session_id
       FROM checkout_attempts
      WHERE id = $1
        AND user_id = $2
      LIMIT 1`,
    [checkoutAttemptId, userId]
  );
  const attempt = attemptRows[0];
  if (!attempt?.stripe_checkout_session_id) return;
  if (attempt.outcome === 'rate_limited' && attempt.reason === FAILED_CARD_ATTEMPT_LIMIT_REASON) return;

  const receiptRows = await query<{ has_receipt: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM app_receipts
        WHERE user_id = $1
          AND type = 'topup'
          AND amount_cents > 0
     ) AS has_receipt`,
    [userId]
  );
  if (receiptRows[0]?.has_receipt) return;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(attempt.stripe_checkout_session_id);
  } catch (error) {
    console.warn('[stripe-webhook] failed to retrieve checkout session for failed-card guard', {
      checkoutAttemptId,
      sessionId: attempt.stripe_checkout_session_id,
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  if (session.status !== 'open' || session.payment_status !== 'unpaid') return;

  try {
    await stripe.checkout.sessions.expire(session.id);
  } catch (error) {
    console.warn('[stripe-webhook] failed to expire checkout session for failed-card guard', {
      checkoutAttemptId,
      sessionId: session.id,
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  await query(
    `UPDATE checkout_attempts
        SET outcome = 'rate_limited',
            reason = $3,
            metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
      WHERE id = $1
        AND user_id = $2`,
    [
      checkoutAttemptId,
      userId,
      FAILED_CARD_ATTEMPT_LIMIT_REASON,
      JSON.stringify({
        failedCardAttempts: failureCount,
        failedCardAttemptLimit: FAILED_CARD_ATTEMPT_LIMIT,
      }),
    ]
  );

  await query(
    `INSERT INTO checkout_interaction_events (
       checkout_attempt_id,
       user_id,
       stripe_checkout_session_id,
       event_name,
       mode,
       amount_cents,
       metadata
     )
     VALUES ($1, $2, $3, 'stripe_checkout_session_expired_for_failed_cards', $4, $5, $6::jsonb)`,
    [
      checkoutAttemptId,
      userId,
      session.id,
      session.metadata?.checkout_ui_mode === 'elements' ? 'express_checkout' : 'hosted',
      session.amount_total,
      JSON.stringify({
        stripe_charge_id: chargeId,
        stripe_payment_intent_id: paymentIntentId,
        failed_card_attempts: failureCount,
        failed_card_attempt_limit: FAILED_CARD_ATTEMPT_LIMIT,
      }),
    ]
  );

  console.warn('[stripe-webhook] expired Checkout session after repeated failed card attempts', {
    checkoutAttemptId,
    failureCount,
    sessionId: session.id,
    userId,
  });
}
