import type Stripe from 'stripe';
import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { CHECKOUT_GUARD_LIMITS as limits } from '@/server/checkout-guard-policy';
import { normalizeStripeId } from './stripe-webhook-documents';

type FailedCardInput = {
  amountCents: number;
  charge: Stripe.Charge | null;
  chargeId: string | null;
  checkoutAttemptId: number;
  checkoutUiMode: string | null;
  intent: Stripe.PaymentIntent | null;
  paymentIntentId: string | null;
  sourceEvent: 'charge.failed' | 'payment_intent.payment_failed';
  userId: string;
  eventId?: string;
  eventCreated?: number;
  currentPaymentSucceeded?: boolean;
};

export type FailedCardLimit = {
  chargeId: string | null;
  limited: boolean;
  legacyLimitReached: boolean;
  failureCount: number;
  distinctCardCount: number;
};

export async function recordCheckoutFailedCardAttempt(input: FailedCardInput): Promise<FailedCardLimit> {
  const { amountCents, charge, checkoutAttemptId, checkoutUiMode, intent, paymentIntentId, sourceEvent, userId } = input;
  const errorMethod = sourceEvent === 'payment_intent.payment_failed' ? intent?.last_payment_error?.payment_method : null;
  const methodId = normalizeStripeId(errorMethod ?? charge?.payment_method);
  // A new authentication failure can retain a previous attempt's latest_charge.
  const errorChargeId = sourceEvent === 'payment_intent.payment_failed' ? normalizeStripeId(intent?.last_payment_error?.charge) : null;
  const retrievedMethodId = normalizeStripeId(charge?.payment_method);
  const staleCharge = Boolean(charge && ((errorChargeId && errorChargeId !== charge.id)
    || (methodId && retrievedMethodId && errorMethod && retrievedMethodId !== methodId)));
  const authenticationFailure = sourceEvent === 'payment_intent.payment_failed'
    && intent?.last_payment_error?.code === 'payment_intent_authentication_failure';
  // The signed error can identify the actual charge even during a GET outage.
  const chargeId = errorChargeId ?? (staleCharge || authenticationFailure ? null : input.chargeId);
  const card = errorMethod?.card ?? (staleCharge ? null : charge?.payment_method_details?.card);
  const fingerprint = card?.fingerprint?.trim() || null;
  const failedAt = typeof input.eventCreated === 'number' && Number.isFinite(input.eventCreated)
    ? Math.min(input.eventCreated, Date.now() / 1000) : Date.now() / 1000;

  return withDbTransaction(async (executor) => {
    // Share the user lock with session preparation; different sessions must not
    // race the account-wide counter or create a session before cooldown commits.
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`wallet-checkout-user:${userId}`]);
    const attempts = await executor.query<{ stripe_checkout_session_id: string | null; outcome: string | null; reason: string | null }>(
      'SELECT stripe_checkout_session_id,outcome,reason FROM checkout_attempts WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [checkoutAttemptId, userId]
    );
    if (!attempts.length) return { chargeId, limited: false, legacyLimitReached: false, failureCount: 0, distinctCardCount: 0 };

    const duplicate = await executor.query<{ found: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM checkout_interaction_events
        WHERE checkout_attempt_id=$1 AND event_name='stripe_charge_failed'
          AND (($2::text IS NOT NULL AND metadata->>'stripe_charge_id'=$2)
            OR ($3::text IS NOT NULL AND metadata->>'stripe_event_id'=$3))) AS found`,
      [checkoutAttemptId, chargeId, input.eventId ?? null]
    );
    if (!duplicate[0]?.found) {
      await executor.query(
        `INSERT INTO checkout_interaction_events
          (checkout_attempt_id,user_id,stripe_checkout_session_id,event_name,mode,amount_cents,metadata,created_at)
         VALUES ($1,$2,NULL,'stripe_charge_failed',$3,$4,$5::jsonb,to_timestamp($6))`,
        [checkoutAttemptId, userId, checkoutUiMode === 'elements' ? 'express_checkout' : 'hosted', amountCents,
          JSON.stringify({
            stripe_charge_id: chargeId, stripe_payment_intent_id: paymentIntentId,
            stripe_payment_method_id: methodId, stripe_event_id: input.eventId ?? null,
            stripe_customer_id: normalizeStripeId(charge?.customer ?? intent?.customer), stripe_event_source: sourceEvent,
            failure_code: staleCharge ? intent?.last_payment_error?.code ?? null : charge?.failure_code ?? intent?.last_payment_error?.code ?? null,
            failure_message: staleCharge ? intent?.last_payment_error?.message ?? null : charge?.failure_message ?? intent?.last_payment_error?.message ?? null,
            decline_code: intent?.last_payment_error?.decline_code ?? null,
            outcome_reason: staleCharge ? null : charge?.outcome?.reason ?? null,
            risk_level: staleCharge ? null : charge?.outcome?.risk_level ?? null,
            card_brand: card?.brand ?? null, card_country: card?.country ?? null, card_fingerprint: fingerprint,
            failed_card_attempt_limit: limits.failedCardAttempts,
          }), failedAt]
      );
    }

    const rows = await executor.query<{ distinct_cards: number; session_failures: number; cooldown: boolean; paid: boolean }>(
      `SELECT
        (SELECT COUNT(DISTINCT NULLIF(metadata->>'card_fingerprint',''))::int
           FROM checkout_interaction_events WHERE user_id=$1 AND event_name='stripe_charge_failed'
            AND created_at >= NOW()-($4::int*INTERVAL '1 second')) AS distinct_cards,
        (SELECT COUNT(DISTINCT COALESCE(NULLIF(metadata->>'stripe_charge_id',''),'event:'||id::text))::int
           FROM checkout_interaction_events WHERE checkout_attempt_id=$2 AND event_name='stripe_charge_failed') AS session_failures,
        EXISTS(SELECT 1 FROM checkout_interaction_events WHERE user_id=$1
          AND (event_name='stripe_failed_card_cooldown_started'
            OR (event_name='stripe_checkout_session_expired_for_failed_cards'
              AND metadata->>'cooldown_started_separately' IS DISTINCT FROM 'true'))
          AND created_at >= NOW()-($5::int*INTERVAL '1 second')) AS cooldown,
        EXISTS(SELECT 1 FROM app_receipts WHERE user_id=$1 AND type='topup' AND amount_cents>0
          AND (stripe_checkout_session_id=$3 OR ($6::text IS NOT NULL AND stripe_payment_intent_id=$6))) AS paid`,
      [userId, checkoutAttemptId, attempts[0].stripe_checkout_session_id, limits.failedCardWindowSeconds,
        limits.failedCardCooldownSeconds, paymentIntentId]
    );
    const row = rows[0];
    const triggered = row.distinct_cards >= limits.distinctFailedCards;
    const limited = !row.paid && !input.currentPaymentSucceeded && intent?.status !== 'succeeded' && (triggered || row.cooldown);
    const legacyLimitReached = !row.paid && !input.currentPaymentSucceeded && intent?.status !== 'succeeded'
      && row.session_failures >= limits.failedCardAttempts
      && !(attempts[0].outcome === 'rate_limited' && attempts[0].reason === 'failed_card_attempt_limit');
    if (limited && !row.cooldown) {
      await startFailedCardCooldown(executor, {
        checkoutAttemptId, userId, sessionId: attempts[0].stripe_checkout_session_id,
        mode: checkoutUiMode === 'elements' ? 'express_checkout' : 'hosted', amountCents,
        distinctCardCount: row.distinct_cards, failureCount: row.session_failures,
      });
    }
    return { chargeId, limited, legacyLimitReached, failureCount: row.session_failures, distinctCardCount: row.distinct_cards };
  });
}

// Callers hold wallet-checkout-user's advisory transaction lock. The separate
// anchor prevents later session expiry/replays from restarting the same pause.
export async function startFailedCardCooldown(executor: TransactionQueryExecutor, input: {
  checkoutAttemptId: number; userId: string; sessionId: string | null;
  mode: string; amountCents: number; distinctCardCount: number; failureCount: number;
}): Promise<void> {
  await executor.query(
    `INSERT INTO checkout_interaction_events
      (checkout_attempt_id,user_id,stripe_checkout_session_id,event_name,mode,amount_cents,metadata)
     SELECT $1,$2,$3,'stripe_failed_card_cooldown_started',$4,$5,$6::jsonb
     WHERE NOT EXISTS (SELECT 1 FROM checkout_interaction_events WHERE user_id=$2
       AND (event_name='stripe_failed_card_cooldown_started'
         OR (event_name='stripe_checkout_session_expired_for_failed_cards'
           AND metadata->>'cooldown_started_separately' IS DISTINCT FROM 'true'))
       AND created_at >= NOW()-($7::int*INTERVAL '1 second'))`,
    [input.checkoutAttemptId,input.userId,input.sessionId,input.mode,input.amountCents,
      JSON.stringify({ distinct_failed_cards: input.distinctCardCount,distinct_card_limit: limits.distinctFailedCards,
        session_failures: input.failureCount,distinct_card_window_seconds: limits.failedCardWindowSeconds,
        cooldown_seconds: limits.failedCardCooldownSeconds }),limits.failedCardCooldownSeconds]
  );
}
