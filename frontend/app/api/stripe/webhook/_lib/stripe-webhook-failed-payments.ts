import { CHECKOUT_GUARD_LIMITS } from '@/server/checkout-guard-policy';
import Stripe from 'stripe';
import { query, withDbTransaction } from '@/lib/db';
import { recordCheckoutFailedCardAttempt, startFailedCardCooldown, type FailedCardLimit } from './stripe-webhook-failed-card-history';
import { normalizeStripeId } from './stripe-webhook-documents';

type FailedTopupPaymentMetadata = {
  kind: string | null;
  userId: string | null;
  checkoutAttemptId: number | null;
  checkoutUiMode: string | null;
};

const FAILED_CARD_ATTEMPT_LIMIT = CHECKOUT_GUARD_LIMITS.failedCardAttempts;
const FAILED_CARD_ATTEMPT_LIMIT_REASON = 'failed_card_attempt_limit';

function readMetadataString(metadata: Stripe.Metadata | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
    checkoutUiMode: readMetadataString(metadata, 'checkout_ui_mode'),
  };
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
  if (metadata.kind !== 'topup' || !metadata.userId || !metadata.checkoutAttemptId) {
    return;
  }

  const paymentIntentId = normalizeStripeId(charge.payment_intent);
  const limit = await recordCheckoutFailedCardAttempt({
    amountCents: charge.amount,
    charge,
    chargeId: charge.id,
    checkoutAttemptId: metadata.checkoutAttemptId,
    checkoutUiMode: metadata.checkoutUiMode,
    intent,
    paymentIntentId,
    sourceEvent: 'charge.failed',
    eventId: event.id,
    eventCreated: event.created,
    userId: metadata.userId,
  });

  if (limit.limited || limit.legacyLimitReached) {
    await expireAccountCheckoutSessionsForFailedCards(
      {
        chargeId: limit.chargeId,
        checkoutAttemptId: metadata.checkoutAttemptId,
        limit,
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
  if (metadata.kind !== 'topup' || !metadata.userId || !metadata.checkoutAttemptId) {
    return;
  }

  const chargeId = normalizeStripeId(intent.latest_charge);
  const charge = chargeId ? await retrieveFailedCharge(chargeId, stripe) : null;
  let currentPaymentSucceeded = false;
  try {
    currentPaymentSucceeded = (await stripe.paymentIntents.retrieve(intent.id)).status === 'succeeded';
  } catch (error) {
    console.warn('[stripe-webhook] failed to inspect current failed-intent payment state', {
      paymentIntentId: intent.id,
      error: error instanceof Error ? error.message : error,
    });
  }
  const limit = await recordCheckoutFailedCardAttempt({
    amountCents: charge?.amount ?? intent.amount,
    charge,
    chargeId,
    checkoutAttemptId: metadata.checkoutAttemptId,
    checkoutUiMode: metadata.checkoutUiMode,
    intent,
    paymentIntentId: intent.id,
    sourceEvent: 'payment_intent.payment_failed',
    eventId: event.id,
    eventCreated: event.created,
    currentPaymentSucceeded,
    userId: metadata.userId,
  });

  if (limit.limited || limit.legacyLimitReached) {
    await expireAccountCheckoutSessionsForFailedCards(
      {
        chargeId: limit.chargeId,
        checkoutAttemptId: metadata.checkoutAttemptId,
        limit,
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

async function expireAccountCheckoutSessionsForFailedCards(
  input: { chargeId: string | null; checkoutAttemptId: number; limit: FailedCardLimit; paymentIntentId: string | null; userId: string },
  stripe: Stripe
): Promise<void> {
  if (!input.limit.limited) {
    // Preserve the existing fifth-failure protection only after confirming that
    // its own session is still open/unpaid. Old expired sessions cannot rearm it.
    const expired = await expireCheckoutSessionForFailedCards({
      chargeId: input.chargeId, checkoutAttemptId: input.checkoutAttemptId,
      failureCount: input.limit.failureCount, distinctCardCount: input.limit.distinctCardCount,
      paymentIntentId: input.paymentIntentId, userId: input.userId, startCooldown: true,
    }, stripe);
    if (!expired) return;
  }
  const attempts = await query<{ id: number | string }>(
    `SELECT id FROM checkout_attempts WHERE user_id=$1 AND stripe_checkout_session_id IS NOT NULL
      AND (id=$2 OR created_at >= NOW()-INTERVAL '1 hour') ORDER BY id`,
    [input.userId, input.checkoutAttemptId]
  );
  for (const attempt of attempts) {
    const id = Number(attempt.id);
    await expireCheckoutSessionForFailedCards({
      chargeId: input.chargeId, checkoutAttemptId: id,
      failureCount: input.limit.failureCount, distinctCardCount: input.limit.distinctCardCount,
      paymentIntentId: id === input.checkoutAttemptId ? input.paymentIntentId : null, userId: input.userId,
    }, stripe);
  }
}

async function expireCheckoutSessionForFailedCards(
  {
    chargeId,
    checkoutAttemptId,
    failureCount,
    distinctCardCount,
    paymentIntentId,
    userId,
    startCooldown = false,
  }: {
    chargeId: string | null;
    checkoutAttemptId: number;
    failureCount: number;
    distinctCardCount: number;
    paymentIntentId: string | null;
    userId: string;
    startCooldown?: boolean;
  },
  stripe: Stripe
): Promise<boolean> {
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
  if (!attempt?.stripe_checkout_session_id) return false;
  if (attempt.outcome === 'rate_limited' && attempt.reason === FAILED_CARD_ATTEMPT_LIMIT_REASON) return false;

  // Protect a payment already credited for this session/intent. An older
  // successful top-up must not exempt later sessions from failed-card limits.
  const receiptRows = await query<{ has_receipt: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM app_receipts
        WHERE user_id = $1
          AND type = 'topup'
          AND amount_cents > 0
          AND (
            stripe_checkout_session_id = $2
            OR ($3::text IS NOT NULL AND stripe_payment_intent_id = $3)
          )
     ) AS has_receipt`,
    [userId, attempt.stripe_checkout_session_id, paymentIntentId]
  );
  if (receiptRows[0]?.has_receipt) return false;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(attempt.stripe_checkout_session_id);
  } catch (error) {
    console.warn('[stripe-webhook] failed to retrieve checkout session for failed-card guard', {
      checkoutAttemptId,
      sessionId: attempt.stripe_checkout_session_id,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }

  if (session.status !== 'open' || session.payment_status !== 'unpaid') return false;

  try {
    await stripe.checkout.sessions.expire(session.id, {}, { idempotencyKey: `failed-card-expiry:${session.id}` });
  } catch (error) {
    console.warn('[stripe-webhook] failed to expire checkout session for failed-card guard', {
      checkoutAttemptId,
      sessionId: session.id,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }

  await withDbTransaction(async (executor) => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`wallet-checkout-user:${userId}`]);
    if (startCooldown) await startFailedCardCooldown(executor, {
      checkoutAttemptId,userId,sessionId:session.id,
      mode:session.metadata?.checkout_ui_mode==='elements'?'express_checkout':'hosted',
      amountCents:session.amount_total ?? 0,distinctCardCount,failureCount,
    });
    const updated = await executor.query<{ id: number | string }>(
      `UPDATE checkout_attempts SET outcome='rate_limited',reason=$3,
        metadata=COALESCE(metadata,'{}'::jsonb)||$4::jsonb
       WHERE id=$1 AND user_id=$2
         AND (outcome IS DISTINCT FROM 'rate_limited' OR reason IS DISTINCT FROM $3)
       RETURNING id`,
      [checkoutAttemptId, userId, FAILED_CARD_ATTEMPT_LIMIT_REASON, JSON.stringify({
        failedCardAttempts: failureCount, failedCardAttemptLimit: FAILED_CARD_ATTEMPT_LIMIT,
        distinctFailedCards: distinctCardCount, distinctFailedCardLimit: CHECKOUT_GUARD_LIMITS.distinctFailedCards,
        failedCardWindowSeconds: CHECKOUT_GUARD_LIMITS.failedCardWindowSeconds,
      })]
    );
    if (!updated.length) return;
    await executor.query(
      `INSERT INTO checkout_interaction_events
        (checkout_attempt_id,user_id,stripe_checkout_session_id,event_name,mode,amount_cents,metadata)
       VALUES ($1,$2,$3,'stripe_checkout_session_expired_for_failed_cards',$4,$5,$6::jsonb)`,
      [checkoutAttemptId,userId,session.id,session.metadata?.checkout_ui_mode==='elements'?'express_checkout':'hosted',
        session.amount_total,JSON.stringify({ stripe_charge_id: chargeId,stripe_payment_intent_id: paymentIntentId,
          failed_card_attempts: failureCount,failed_card_attempt_limit: FAILED_CARD_ATTEMPT_LIMIT,
          distinct_failed_cards: distinctCardCount,distinct_failed_card_limit: CHECKOUT_GUARD_LIMITS.distinctFailedCards,
          failed_card_window_seconds: CHECKOUT_GUARD_LIMITS.failedCardWindowSeconds,
          cooldown_started_separately: true })]
    );
  });

  console.warn('[stripe-webhook] expired Checkout session after repeated failed card attempts', {
    checkoutAttemptId,
    failureCount,
    distinctCardCount,
    sessionId: session.id,
    userId,
  });
  return true;
}
