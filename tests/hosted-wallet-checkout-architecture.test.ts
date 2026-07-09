import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sharedHookPath = 'frontend/hooks/useHostedWalletCheckout.ts';
const sharedEventsPath = 'frontend/lib/analytics/checkout-interaction-events.ts';
const sharedTurnstilePath = 'frontend/components/ui/TurnstileChallenge.tsx';
const billingEventFacadePath = 'frontend/app/(core)/billing/_lib/checkout-interaction-events.ts';
const billingTurnstileFacadePath = 'frontend/app/(core)/billing/_components/TurnstileChallenge.tsx';

test('hosted wallet checkout behavior has stable shared owners', () => {
  for (const file of [sharedHookPath, sharedEventsPath, sharedTurnstilePath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
  const hookSource = readFileSync(sharedHookPath, 'utf8');
  const eventFacadeSource = readFileSync(billingEventFacadePath, 'utf8');
  const turnstileFacadeSource = readFileSync(billingTurnstileFacadePath, 'utf8');
  assert.match(hookSource, /requestHostedWalletCheckout/);
  assert.match(hookSource, /hosted_checkout_requested/);
  assert.match(hookSource, /hosted_checkout_captcha_required/);
  assert.match(hookSource, /hosted_checkout_rate_limited/);
  assert.match(hookSource, /hosted_checkout_failed/);
  assert.match(hookSource, /hosted_checkout_redirecting/);
  assert.match(hookSource, /submissionGuardRef/);
  assert.match(eventFacadeSource, /export \{ recordCheckoutInteractionEvent \}/);
  assert.match(turnstileFacadeSource, /export \{ TurnstileChallenge \}/);
});
