import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV, receiptsPriceOnlyEnabled } from '@/lib/env';
import {
  beginStripeEvent,
  markStripeEventProcessed,
  rollbackStripeEvent,
} from './_lib/stripe-webhook-event-state';
import { handleChargeFailed, handlePaymentIntentFailed } from './_lib/stripe-webhook-failed-payments';
import { handleChargeRefunded } from './_lib/stripe-webhook-refunds';
import {
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
} from './_lib/stripe-webhook-topup-events';

const stripeSecret = ENV.STRIPE_SECRET_KEY;
const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export const runtime = 'nodejs';
const receiptsPriceOnly = receiptsPriceOnlyEnabled();
const HANDLED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.failed',
]);

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
    if (!HANDLED_EVENT_TYPES.has(event.type)) {
      console.log('[stripe-webhook] Unhandled event type', event.type);
      return NextResponse.json({ received: true });
    }

    const shouldProcess = await beginStripeEvent(event);
    if (!shouldProcess) {
      console.log('[stripe-webhook] Skipping duplicate event', { eventId: event.id, type: event.type });
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session, { stripe, receiptsPriceOnly });
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(intent, { stripe, receiptsPriceOnly });
        break;
      }
      case 'payment_intent.payment_failed': {
        await handlePaymentIntentFailed(event, stripe);
        break;
      }
      case 'charge.refunded': {
        await handleChargeRefunded(event, stripe);
        break;
      }
      case 'charge.failed': {
        await handleChargeFailed(event, stripe);
        break;
      }
    }

    await markStripeEventProcessed(event.id);
  } catch (error) {
    await rollbackStripeEvent(event.id);
    console.error('[stripe-webhook] Handler error', error);
    return NextResponse.json({ error: 'Webhook handler failure' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
