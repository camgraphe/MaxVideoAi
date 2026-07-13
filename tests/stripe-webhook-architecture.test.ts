import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/api/stripe/webhook/route.ts';
const eventStatePath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts';
const failedPaymentsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-failed-payments.ts';
const refundsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-refunds.ts';
const documentsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-documents.ts';
const topupEventsPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-events.ts';
const topupPersistencePath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts';
const processorPath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-processor.ts';

test('Stripe webhook event idempotency has one route-local owner', () => {
  assert.equal(existsSync(eventStatePath), true);
  assert.equal(existsSync(processorPath), true);
  const route = readFileSync(routePath, 'utf8');
  const processor = readFileSync(processorPath, 'utf8');
  const eventState = readFileSync(eventStatePath, 'utf8');

  assert.match(processor, /from ['"]\.\/stripe-webhook-event-state['"]/);
  assert.doesNotMatch(route, /stripe_webhook_events/);
  assert.match(eventState, /export async function beginStripeEvent/);
  assert.match(eventState, /export async function markStripeEventProcessed/);
  assert.match(eventState, /export async function rollbackStripeEvent/);
  assert.match(eventState, /ON CONFLICT \(event_id\) DO NOTHING/);
});

test('failed-payment protection and refund analytics have separate owners', () => {
  assert.equal(existsSync(failedPaymentsPath), true);
  assert.equal(existsSync(refundsPath), true);
  assert.equal(existsSync(processorPath), true);
  const route = readFileSync(routePath, 'utf8');
  const processor = readFileSync(processorPath, 'utf8');
  const failedPayments = readFileSync(failedPaymentsPath, 'utf8');
  const refunds = readFileSync(refundsPath, 'utf8');

  assert.match(processor, /stripe-webhook-failed-payments/);
  assert.match(processor, /stripe-webhook-refunds/);
  assert.doesNotMatch(route, /FAILED_CARD_ATTEMPT_LIMIT|topup_refunded/);
  assert.match(failedPayments, /const FAILED_CARD_ATTEMPT_LIMIT = 5/);
  assert.match(failedPayments, /stripe_checkout_session_expired_for_failed_cards/);
  assert.match(refunds, /name: 'topup_refunded'/);
});

test('successful Stripe events share one canonical top-up persistence owner', () => {
  for (const path of [documentsPath, topupEventsPath, topupPersistencePath]) {
    assert.equal(existsSync(path), true);
  }
  const route = readFileSync(routePath, 'utf8');
  const topupEvents = readFileSync(topupEventsPath, 'utf8');
  const persistence = readFileSync(topupPersistencePath, 'utf8');

  assert.equal((topupEvents.match(/recordStripeTopup\(/g) ?? []).length, 2);
  assert.match(persistence, /withDbTransaction/);
  assert.match(persistence, /lockAndResolveFirstWalletTopup/);
  assert.match(persistence, /name: 'topup_completed'/);
  assert.match(persistence, /name: 'purchase'/);
  assert.doesNotMatch(route, /recordStripeTopup|withDbTransaction|topup_completed/);
});

test('Stripe webhook route owns only verification and HTTP mapping', () => {
  assert.equal(existsSync(processorPath), true);
  const route = readFileSync(routePath, 'utf8');
  const lineCount = route.split('\n').length;

  assert.ok(lineCount < 140, `route.ts must stay below 140 lines, got ${lineCount}`);
  assert.match(route, /request\.arrayBuffer\(\)/);
  assert.match(route, /request\.headers\.get\('stripe-signature'\)/);
  assert.match(route, /stripe\.webhooks\.constructEvent/);
  assert.match(route, /processStripeWebhookEvent/);
  assert.doesNotMatch(route, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/);
  assert.doesNotMatch(route, /sendGa4Event|recordMockWalletTopUp|withDbTransaction/);
});

test('Stripe webhook modules stay focused instead of creating a new catch-all', () => {
  for (const path of [
    eventStatePath,
    failedPaymentsPath,
    refundsPath,
    documentsPath,
    topupEventsPath,
    topupPersistencePath,
    processorPath,
  ]) {
    assert.equal(existsSync(path), true);
    const lineCount = readFileSync(path, 'utf8').split('\n').length;
    assert.ok(lineCount < 500, `${path} must stay below 500 lines, got ${lineCount}`);
  }
});
