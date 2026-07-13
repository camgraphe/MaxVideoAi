import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV, receiptsPriceOnlyEnabled } from '@/lib/env';
import { processStripeWebhookEvent } from './_lib/stripe-webhook-event-processor';

const stripeSecret = ENV.STRIPE_SECRET_KEY;
const webhookSecret = ENV.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export const runtime = 'nodejs';
const receiptsPriceOnly = receiptsPriceOnlyEnabled();

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
    const result = await processStripeWebhookEvent(event, { stripe, receiptsPriceOnly });
    if (result === 'duplicate') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe-webhook] Handler error', error);
    return NextResponse.json({ error: 'Webhook handler failure' }, { status: 500 });
  }
}
