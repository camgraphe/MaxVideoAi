import Stripe from 'stripe';

import {
  beginStripeEvent,
  markStripeEventProcessed,
  rollbackStripeEvent,
} from './stripe-webhook-event-state';
import { handleChargeFailed, handlePaymentIntentFailed } from './stripe-webhook-failed-payments';
import { handleChargeRefunded } from './stripe-webhook-refunds';
import {
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
} from './stripe-webhook-topup-events';

const HANDLED_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.failed',
]);

export type StripeWebhookEventResult = 'handled' | 'unhandled' | 'duplicate';

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  options: { stripe: Stripe; receiptsPriceOnly: boolean }
): Promise<StripeWebhookEventResult> {
  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    console.log('[stripe-webhook] Unhandled event type', event.type);
    return 'unhandled';
  }

  if (!(await beginStripeEvent(event))) {
    console.log('[stripe-webhook] Skipping duplicate event', { eventId: event.id, type: event.type });
    return 'duplicate';
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, options);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, options);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event, options.stripe);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event, options.stripe);
        break;
      case 'charge.failed':
        await handleChargeFailed(event, options.stripe);
        break;
    }

    await markStripeEventProcessed(event.id);
    return 'handled';
  } catch (error) {
    await rollbackStripeEvent(event.id);
    throw error;
  }
}
