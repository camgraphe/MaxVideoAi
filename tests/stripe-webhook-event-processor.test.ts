import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';

import {
  createStripeWebhookEventProcessor,
  type StripeWebhookEventProcessorDependencies,
} from '../frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts';

function stripeEvent(type: string): Stripe.Event {
  return {
    id: `evt_${type.replaceAll('.', '_')}`,
    object: 'event',
    api_version: '2023-10-16',
    created: 0,
    data: { object: { id: 'stripe_object' } as Stripe.Event.Data.Object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

function recordingDependencies(
  calls: string[],
  options: { claimed?: boolean; handlerError?: Error } = {}
): StripeWebhookEventProcessorDependencies {
  const recordHandler = async (name: string) => {
    calls.push(`dispatch:${name}`);
    if (options.handlerError) throw options.handlerError;
  };

  return {
    beginStripeEvent: async (event) => {
      calls.push(`claim:${event.id}`);
      return options.claimed ?? true;
    },
    markStripeEventProcessed: async (eventId) => {
      calls.push(`mark:${eventId}`);
    },
    rollbackStripeEvent: async (eventId) => {
      calls.push(`rollback:${eventId}`);
    },
    handleCheckoutSessionCompleted: async () => recordHandler('checkout.session.completed'),
    handlePaymentIntentSucceeded: async () => recordHandler('payment_intent.succeeded'),
    handlePaymentIntentFailed: async () => recordHandler('payment_intent.payment_failed'),
    handleChargeRefunded: async () => recordHandler('charge.refunded'),
    handleChargeFailed: async () => recordHandler('charge.failed'),
  };
}

const processorOptions = {
  stripe: {} as Stripe,
  receiptsPriceOnly: false,
};

test('unsupported events are unhandled without claiming them', async () => {
  const calls: string[] = [];
  const processEvent = createStripeWebhookEventProcessor(recordingDependencies(calls));

  const result = await processEvent(stripeEvent('customer.created'), processorOptions);

  assert.equal(result, 'unhandled');
  assert.deepEqual(calls, []);
});

test('duplicate events stop after the claim without dispatching or marking', async () => {
  const calls: string[] = [];
  const event = stripeEvent('checkout.session.completed');
  const processEvent = createStripeWebhookEventProcessor(
    recordingDependencies(calls, { claimed: false })
  );

  const result = await processEvent(event, processorOptions);

  assert.equal(result, 'duplicate');
  assert.deepEqual(calls, [`claim:${event.id}`]);
});

test('handled events dispatch before they are marked processed', async () => {
  const calls: string[] = [];
  const event = stripeEvent('checkout.session.completed');
  const processEvent = createStripeWebhookEventProcessor(recordingDependencies(calls));

  const result = await processEvent(event, processorOptions);

  assert.equal(result, 'handled');
  assert.deepEqual(calls, [
    `claim:${event.id}`,
    'dispatch:checkout.session.completed',
    `mark:${event.id}`,
  ]);
});

test('handler failures roll back the claim and rethrow the same error', async () => {
  const calls: string[] = [];
  const event = stripeEvent('checkout.session.completed');
  const handlerError = new Error('handler failed');
  const processEvent = createStripeWebhookEventProcessor(
    recordingDependencies(calls, { handlerError })
  );

  await assert.rejects(
    () => processEvent(event, processorOptions),
    (error) => {
      assert.equal(error, handlerError);
      return true;
    }
  );
  assert.deepEqual(calls, [
    `claim:${event.id}`,
    'dispatch:checkout.session.completed',
    `rollback:${event.id}`,
  ]);
});
