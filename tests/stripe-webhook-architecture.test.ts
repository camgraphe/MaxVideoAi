import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/api/stripe/webhook/route.ts';
const eventStatePath = 'frontend/app/api/stripe/webhook/_lib/stripe-webhook-event-state.ts';

test('Stripe webhook event idempotency has one route-local owner', () => {
  assert.equal(existsSync(eventStatePath), true);
  const route = readFileSync(routePath, 'utf8');
  const eventState = readFileSync(eventStatePath, 'utf8');

  assert.match(route, /from ['"]\.\/_lib\/stripe-webhook-event-state['"]/);
  assert.doesNotMatch(route, /stripe_webhook_events/);
  assert.match(eventState, /export async function beginStripeEvent/);
  assert.match(eventState, /export async function markStripeEventProcessed/);
  assert.match(eventState, /export async function rollbackStripeEvent/);
  assert.match(eventState, /ON CONFLICT \(event_id\) DO NOTHING/);
});
