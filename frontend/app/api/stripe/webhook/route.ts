import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { ensureBillingSchema } from '@/lib/schema';
import { query } from '@/lib/db';

const stripeSecret = ENV.STRIPE_SECRET_KEY;
const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export const runtime = 'nodejs';

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
      default:
        console.log('[stripe-webhook] Unhandled event type', event.type);
    }
  } catch (error) {
    console.error('[stripe-webhook] Handler error', error);
    return NextResponse.json({ error: 'Webhook handler failure' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  if (!session.metadata || session.metadata.kind !== 'topup') {
    return;
  }
  const userId = session.metadata.user_id;
  if (!userId) return;

  const amountCents = session.amount_total ?? null;
  const currency = session.currency ?? 'usd';
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  const chargeId = typeof session.payment_intent === 'object' && session.payment_intent && !Array.isArray(session.payment_intent)
    ? (typeof session.payment_intent.latest_charge === 'string'
        ? session.payment_intent.latest_charge
        : session.payment_intent.latest_charge?.id ?? null)
    : null;

  if (!amountCents || amountCents <= 0) return;

  await recordTopup({
    userId,
    amountCents,
    currency,
    paymentIntentId,
    chargeId,
    metadata: { sessionId: session.id, source: 'checkout.session.completed' },
  });
}

async function handlePaymentIntent(intent: Stripe.PaymentIntent) {
  if (!intent.metadata || intent.metadata.kind !== 'topup') {
    return;
  }
  const userId = intent.metadata.user_id;
  if (!userId) return;

  const amountCents = intent.amount_received ?? intent.amount ?? null;
  const currency = intent.currency ?? 'usd';
  const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : intent.latest_charge?.id ?? null;

  if (!amountCents || amountCents <= 0) return;

  await recordTopup({
    userId,
    amountCents,
    currency,
    paymentIntentId: intent.id,
    chargeId,
    metadata: { source: 'payment_intent.succeeded' },
  });
}

async function recordTopup({
  userId,
  amountCents,
  currency,
  paymentIntentId,
  chargeId,
  metadata,
}: {
  userId: string;
  amountCents: number;
  currency: string;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await ensureBillingSchema();

  const normalizedCurrency = currency ? currency.toUpperCase() : 'USD';
  const normalizedAmount = Math.max(0, Math.round(amountCents));
  if (normalizedAmount <= 0) return;

  if (paymentIntentId) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`,
      [paymentIntentId]
    );
    if (existing.length > 0) {
      return;
    }
  }

  if (chargeId) {
    const existingCharge = await query<{ id: string }>(
      `SELECT id FROM app_receipts WHERE stripe_charge_id = $1 LIMIT 1`,
      [chargeId]
    );
    if (existingCharge.length > 0) {
      return;
    }
  }

  await query(
    `INSERT INTO app_receipts (user_id, type, amount_cents, currency, description, metadata, stripe_payment_intent_id, stripe_charge_id)
     VALUES ($1, 'topup', $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      normalizedAmount,
      normalizedCurrency,
      'Wallet top-up',
      metadata ?? null,
      paymentIntentId ?? null,
      chargeId ?? null,
    ]
  );

  console.log('[stripe-webhook] Recorded wallet top-up', {
    userId,
    amountCents: normalizedAmount,
    currency: normalizedCurrency,
    paymentIntentId,
    chargeId,
  });
}
