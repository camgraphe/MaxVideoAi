import type Stripe from 'stripe';
import { query } from '@/lib/db';

const EXPRESS_CHECKOUT_REUSE_WINDOW_SECONDS = 5 * 60;

type CheckoutSessionReuseRow = {
  stripe_checkout_session_id: string | null;
};

type StripeCheckoutSessionRetriever = Pick<Stripe, 'checkout'>;

export type ReusableStripeCheckoutSessionInput = {
  clientSecret?: string | null;
  created?: number | null;
  expiresAt?: number | null;
  now?: number;
  paymentStatus?: string | null;
  status?: string | null;
};

export function isReusableStripeCheckoutSession({
  clientSecret,
  expiresAt,
  now = Math.floor(Date.now() / 1000),
  paymentStatus,
  status,
}: ReusableStripeCheckoutSessionInput): boolean {
  const expiresAtSeconds = typeof expiresAt === 'number' && Number.isFinite(expiresAt) ? expiresAt : null;
  return Boolean(
    clientSecret &&
      status === 'open' &&
      paymentStatus === 'unpaid' &&
      expiresAtSeconds !== null &&
      expiresAtSeconds > now
  );
}

export async function findReusableExpressCheckoutSession(
  stripe: StripeCheckoutSessionRetriever,
  {
    amountCents,
    currency,
    userId,
  }: {
    amountCents: number;
    currency: string;
    userId: string;
  }
): Promise<{ clientSecret: string; id: string } | null> {
  const rows = await query<CheckoutSessionReuseRow>(
    `SELECT stripe_checkout_session_id
       FROM checkout_attempts
      WHERE user_id = $1
        AND amount_cents = $2
        AND mode = 'express_checkout'
        AND outcome = 'session_created'
        AND stripe_checkout_session_id IS NOT NULL
        AND metadata->>'currency' = $3
        AND metadata->>'checkoutUiMode' = 'elements'
        AND created_at >= NOW() - ($4::int * INTERVAL '1 second')
      ORDER BY created_at DESC
      LIMIT 3`,
    [userId, amountCents, currency.toUpperCase(), EXPRESS_CHECKOUT_REUSE_WINDOW_SECONDS]
  );

  const now = Math.floor(Date.now() / 1000);
  for (const row of rows) {
    const sessionId = row.stripe_checkout_session_id;
    if (!sessionId) continue;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        isReusableStripeCheckoutSession({
          clientSecret: session.client_secret,
          expiresAt: session.expires_at,
          now,
          paymentStatus: session.payment_status,
          status: session.status,
        })
      ) {
        return { clientSecret: session.client_secret as string, id: session.id };
      }
    } catch (error) {
      console.warn('[payments] failed to inspect reusable express checkout session', {
        sessionId,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  return null;
}
