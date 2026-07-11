import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('wallet validates once and copies attribution to Stripe metadata', () => {
  const source = readFileSync('frontend/app/api/wallet/route.ts', 'utf8');
  assert.match(source, /const analyticsConsentGranted = hasAnalyticsConsent\(req\)/);
  assert.match(source, /const walletAttribution = normalizeWalletAttribution/);
  assert.match(source, /Object\.assign\(sessionMetadata, walletAttributionMetadata\)/);
  assert.match(source, /findReusableExpressCheckoutSession\([\s\S]*attribution: walletAttribution/);
  assert.equal((source.match(/normalizeWalletAttribution\(/g) ?? []).length, 1);
});

test('Stripe completion emits accepted attribution and first-topup state', () => {
  const source = readFileSync('frontend/app/api/stripe/webhook/route.ts', 'utf8');
  assert.match(source, /buildTopupAttributionGa4Params/);
  assert.match(source, /\.\.\.attributionParams/);
  assert.match(source, /funnel_stage: 'topup_completed'/);
  assert.match(source, /is_first_wallet_topup: persistenceResult\.isFirstWalletTopup/);
  assert.doesNotMatch(source, /String\(metadataRecord\.first_wallet_topup/);
  assert.match(source, /name: 'topup_completed'/);
  assert.match(source, /name: 'purchase'/);
  assert.match(source, /await Promise\.allSettled\(\[/);
  assert.doesNotMatch(source, /attribution_fingerprint:\s*metadataRecord/);
});
