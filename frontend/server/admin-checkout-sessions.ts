import Stripe from 'stripe';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { logAdminAction } from '@/server/admin-audit';

export const ADMIN_EXPIRED_CHECKOUT_SESSION_REASON = 'admin_expired_checkout_session';

type CheckoutAttemptForExpiration = {
  id: number | string;
  user_id: string;
  amount_cents: number | string;
  mode: 'hosted' | 'express_checkout';
  outcome: string;
  reason: string | null;
  stripe_checkout_session_id: string | null;
  has_receipt: boolean;
};

export type ExpireAdminCheckoutSessionResult = {
  attemptId: number;
  sessionId: string;
  status: 'expired' | 'already_expired';
};

type ExpireAdminCheckoutSessionParams = {
  adminUserId: string;
  attemptId: number;
  expectedSessionId?: string | null;
  stripe: Pick<Stripe, 'checkout'>;
};

function normalizeSessionStatus(status: Stripe.Checkout.Session.Status | null): string {
  return status ?? 'unknown';
}

async function fetchAttemptForExpiration(
  executor: QueryExecutor,
  attemptId: number
): Promise<CheckoutAttemptForExpiration | null> {
  const rows = await executor.query<CheckoutAttemptForExpiration>(
    `SELECT
       attempt.id,
       attempt.user_id,
       attempt.amount_cents,
       attempt.mode,
       attempt.outcome,
       attempt.reason,
       attempt.stripe_checkout_session_id,
       (receipt.id IS NOT NULL) AS has_receipt
     FROM checkout_attempts attempt
     LEFT JOIN app_receipts receipt
       ON receipt.stripe_checkout_session_id = attempt.stripe_checkout_session_id
      AND receipt.type = 'topup'
     WHERE attempt.id = $1
     LIMIT 1`,
    [attemptId]
  );
  return rows[0] ?? null;
}

async function ensureAttemptStillHasNoReceipt(executor: QueryExecutor, sessionId: string): Promise<void> {
  const rows = await executor.query<{ receipt_count: number | string }>(
    `SELECT COUNT(*)::int AS receipt_count
       FROM app_receipts
      WHERE stripe_checkout_session_id = $1
        AND type = 'topup'`,
    [sessionId]
  );
  if (Number(rows[0]?.receipt_count ?? 0) > 0) {
    throw new Error('Checkout session already has a wallet top-up receipt');
  }
}

export async function expireAdminCheckoutSession({
  adminUserId,
  attemptId,
  expectedSessionId,
  stripe,
}: ExpireAdminCheckoutSessionParams): Promise<ExpireAdminCheckoutSessionResult> {
  if (!Number.isFinite(attemptId) || attemptId <= 0) {
    throw new Error('Invalid checkout attempt');
  }

  const attempt = await fetchAttemptForExpiration({ query }, attemptId);
  if (!attempt) {
    throw new Error('Checkout attempt not found');
  }

  const sessionId = attempt.stripe_checkout_session_id;

  if (!sessionId) {
    throw new Error('Checkout attempt has no Stripe session');
  }
  if (expectedSessionId && expectedSessionId !== sessionId) {
    throw new Error('Checkout session mismatch');
  }
  if (attempt.has_receipt) {
    throw new Error('Checkout session already has a wallet top-up receipt');
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'unpaid') {
    throw new Error('Checkout session is not unpaid');
  }
  if (session.status === 'complete') {
    throw new Error('Checkout session is already complete');
  }

  let expiredSession: Stripe.Checkout.Session;
  let status: ExpireAdminCheckoutSessionResult['status'];
  if (session.status === 'expired') {
    expiredSession = session;
    status = 'already_expired';
  } else {
    if (session.status !== 'open') {
      throw new Error(`Checkout session cannot be expired from status ${normalizeSessionStatus(session.status)}`);
    }

    await ensureAttemptStillHasNoReceipt({ query }, sessionId);
    expiredSession = await stripe.checkout.sessions.expire(sessionId);
    status = 'expired';
  }

  await withDbTransaction(async (executor) => {
    await ensureAttemptStillHasNoReceipt(executor, sessionId);
    await executor.query(
      `UPDATE checkout_attempts
          SET outcome = 'session_failed',
              reason = $2,
              metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
        WHERE id = $1`,
      [
        attemptId,
        ADMIN_EXPIRED_CHECKOUT_SESSION_REASON,
        JSON.stringify({
          admin_expired_at: new Date().toISOString(),
          admin_expired_by: adminUserId,
          previous_outcome: attempt.outcome,
          previous_reason: attempt.reason,
          stripe_admin_expire_status: status,
        }),
      ]
    );

    await executor.query(
      `INSERT INTO checkout_interaction_events (
         checkout_attempt_id,
         user_id,
         stripe_checkout_session_id,
         event_name,
         mode,
         amount_cents,
         metadata
       )
       VALUES ($1, $2, $3, 'admin_checkout_session_expired', $4, $5, $6::jsonb)`,
      [
        attemptId,
        attempt.user_id,
        sessionId,
        attempt.mode,
        Number(attempt.amount_cents ?? 0),
        JSON.stringify({
          admin_user_id: adminUserId,
          previous_outcome: attempt.outcome,
          previous_reason: attempt.reason,
          stripe_admin_expire_status: status,
          stripe_status_before: session.status,
          stripe_payment_status_before: session.payment_status,
          stripe_status_after: expiredSession.status,
          stripe_payment_status_after: expiredSession.payment_status,
        }),
      ]
    );
  });

  await logAdminAction({
    adminId: adminUserId,
    targetUserId: attempt.user_id,
    action: 'checkout_session_expired',
    route: '/api/admin/checkout-sessions/expire',
    metadata: {
      attemptId,
      sessionId,
      status,
    },
  });

  return {
    attemptId,
    sessionId,
    status,
  };
}
