import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('wallet validates once and copies attribution to Stripe metadata', () => {
  const source = readFileSync('frontend/app/api/wallet/route.ts', 'utf8');
  assert.match(source, /const analyticsConsentGranted = hasAnalyticsConsent\(req\)/);
  assert.match(source, /const walletAttribution = normalizeWalletAttribution/);
  assert.match(source, /Object\.assign\(sessionMetadata, walletAttributionMetadata\)/);
  assert.match(source, /findReusableExpressCheckoutSession\([\s\S]*attribution: walletAttribution/);
  assert.match(source, /resolveWalletGa4CheckoutContext/);
  assert.match(source, /Object\.assign\(sessionMetadata, walletGa4Context\.metadata\)/);
  assert.equal((source.match(/normalizeWalletAttribution\(/g) ?? []).length, 1);
});

test('Stripe completion persists recoverable receipt intents and delegates GA4 projection', () => {
  const source = readFileSync('frontend/app/api/stripe/webhook/_lib/stripe-webhook-topup-persistence.ts','utf8');
  assert.match(source, /enqueueGa4WalletReceiptSafely\(executor/);
  assert.match(source, /ga4_outbox_version: '1'/);
  assert.doesNotMatch(source, /sendGa4Event/);
  const projection = readFileSync('frontend/server/ga4-wallet-events.ts','utf8');
  assert.match(projection, /buildTopupAttributionGa4Params/);
  assert.match(projection, /normalizeGa4SessionId/);
  assert.doesNotMatch(projection, /attribution_fingerprint:\s*m/);
});
