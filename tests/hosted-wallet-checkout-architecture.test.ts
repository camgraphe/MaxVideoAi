import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sharedHookPath = 'frontend/hooks/useHostedWalletCheckout.ts';
const sharedEventsPath = 'frontend/lib/analytics/checkout-interaction-events.ts';
const sharedTurnstilePath = 'frontend/components/ui/TurnstileChallenge.tsx';
const billingEventFacadePath = 'frontend/app/(core)/billing/_lib/checkout-interaction-events.ts';
const billingTurnstileFacadePath = 'frontend/app/(core)/billing/_components/TurnstileChallenge.tsx';
const billingClientPath = 'frontend/app/(core)/billing/_components/BillingClient.tsx';
const billingWalletPanelPath = 'frontend/app/(core)/billing/_components/WalletTopupPanel.tsx';
const workspacePricingPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate.ts';
const workspaceTopupModalPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal.tsx';
const sharedRateLimitPath = 'frontend/lib/wallet/rate-limit-message.ts';

test('hosted wallet checkout behavior has stable shared owners', () => {
  for (const file of [sharedHookPath, sharedEventsPath, sharedTurnstilePath, sharedRateLimitPath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
  const hookSource = readFileSync(sharedHookPath, 'utf8');
  const eventFacadeSource = readFileSync(billingEventFacadePath, 'utf8');
  const turnstileFacadeSource = readFileSync(billingTurnstileFacadePath, 'utf8');
  const billingClientSource = readFileSync(billingClientPath, 'utf8');
  const billingWalletPanelSource = readFileSync(billingWalletPanelPath, 'utf8');
  const workspacePricingSource = readFileSync(workspacePricingPath, 'utf8');
  const workspaceTopupModalSource = readFileSync(workspaceTopupModalPath, 'utf8');
  assert.match(hookSource, /requestHostedWalletCheckout/);
  assert.match(hookSource, /hosted_checkout_requested/);
  assert.match(hookSource, /hosted_checkout_captcha_required/);
  assert.match(hookSource, /hosted_checkout_rate_limited/);
  assert.match(hookSource, /hosted_checkout_failed/);
  assert.match(hookSource, /hosted_checkout_redirecting/);
  assert.match(hookSource, /submissionGuardRef/);
  assert.match(hookSource, /hostedCheckoutChallengeReducer/);
  assert.match(hookSource, /beginHostedWalletCheckoutAttempt\(\);/);
  assert.doesNotMatch(hookSource, /if \(returnTarget\) beginHostedWalletCheckoutAttempt/);
  assert.match(hookSource, /captchaResetGeneration/);
  assert.match(eventFacadeSource, /export \{ recordCheckoutInteractionEvent \}/);
  assert.match(turnstileFacadeSource, /export \{ TurnstileChallenge \}/);
  assert.match(readFileSync(sharedTurnstilePath, 'utf8'), /resetGeneration/);
  assert.match(billingClientSource, /useHostedWalletCheckout/);
  assert.match(billingWalletPanelSource, /resetGeneration=\{checkoutCaptchaResetGeneration\}/);
  assert.doesNotMatch(billingClientSource, /fetch\('\/api\/wallet'/);
  assert.match(workspacePricingSource, /useHostedWalletCheckout/);
  assert.match(workspacePricingSource, /from '@\/lib\/wallet\/rate-limit-message';/);
  assert.doesNotMatch(workspacePricingSource, /authFetch\('\/api\/wallet',\s*\{/);
  assert.match(workspaceTopupModalSource, /resetGeneration=\{checkoutCaptchaResetGeneration\}/);
});
