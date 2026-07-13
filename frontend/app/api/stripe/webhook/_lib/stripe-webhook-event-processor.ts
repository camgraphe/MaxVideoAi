import type Stripe from 'stripe';

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

export type StripeWebhookEventProcessorDependencies = {
  beginStripeEvent: typeof beginStripeEvent;
  markStripeEventProcessed: typeof markStripeEventProcessed;
  rollbackStripeEvent: typeof rollbackStripeEvent;
  handleCheckoutSessionCompleted: typeof handleCheckoutSessionCompleted;
  handlePaymentIntentSucceeded: typeof handlePaymentIntentSucceeded;
  handlePaymentIntentFailed: typeof handlePaymentIntentFailed;
  handleChargeRefunded: typeof handleChargeRefunded;
  handleChargeFailed: typeof handleChargeFailed;
};

export type StripeWebhookEventProcessorOptions = {
  stripe: Stripe;
  receiptsPriceOnly: boolean;
};

export type StripeWebhookEventProcessor = (
  event: Stripe.Event,
  options: StripeWebhookEventProcessorOptions
) => Promise<StripeWebhookEventResult>;

export function createStripeWebhookEventProcessor(
  dependencies: StripeWebhookEventProcessorDependencies
): StripeWebhookEventProcessor {
  return async function processEvent(
    event: Stripe.Event,
    options: StripeWebhookEventProcessorOptions
  ): Promise<StripeWebhookEventResult> {
    if (!HANDLED_EVENT_TYPES.has(event.type)) {
      console.log('[stripe-webhook] Unhandled event type', event.type);
      return 'unhandled';
    }

    if (!(await dependencies.beginStripeEvent(event))) {
      console.log('[stripe-webhook] Skipping duplicate event', { eventId: event.id, type: event.type });
      return 'duplicate';
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await dependencies.handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
            options
          );
          break;
        case 'payment_intent.succeeded':
          await dependencies.handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
            options
          );
          break;
        case 'payment_intent.payment_failed':
          await dependencies.handlePaymentIntentFailed(event, options.stripe);
          break;
        case 'charge.refunded':
          await dependencies.handleChargeRefunded(event, options.stripe);
          break;
        case 'charge.failed':
          await dependencies.handleChargeFailed(event, options.stripe);
          break;
      }

      await dependencies.markStripeEventProcessed(event.id);
      return 'handled';
    } catch (error) {
      await dependencies.rollbackStripeEvent(event.id);
      throw error;
    }
  };
}

export const processStripeWebhookEvent = createStripeWebhookEventProcessor({
  beginStripeEvent,
  markStripeEventProcessed,
  rollbackStripeEvent,
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handleChargeRefunded,
  handleChargeFailed,
});
