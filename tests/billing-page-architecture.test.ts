import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/billing/page.tsx';
const clientPath = 'frontend/app/(core)/billing/_components/BillingClient.tsx';
const walletPanelPath = 'frontend/app/(core)/billing/_components/WalletTopupPanel.tsx';
const receiptsPanelPath = 'frontend/app/(core)/billing/_components/ReceiptsPanel.tsx';
const expressCheckoutPath = 'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx';
const analyticsHookPath = 'frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts';
const copyPath = 'frontend/app/(core)/billing/_lib/billing-copy.ts';
const typesPath = 'frontend/app/(core)/billing/_lib/billing-types.ts';
const utilsPath = 'frontend/app/(core)/billing/_lib/billing-utils.ts';

test('billing page delegates client billing behavior to route-local modules', () => {
  for (const file of [
    clientPath,
    walletPanelPath,
    receiptsPanelPath,
    expressCheckoutPath,
    analyticsHookPath,
    copyPath,
    typesPath,
    utilsPath,
  ]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 30, `expected billing page to stay under 30 lines, got ${pageLines}`);
  assert.doesNotMatch(pageSource, /'use client'/);
  assert.match(pageSource, /import \{ BillingClient \} from '\.\/_components\/BillingClient';/);
  assert.match(pageSource, /export const dynamic = 'force-dynamic';/);
});

test('billing client keeps orchestration separate from copy, checkout widgets, and receipts UI', () => {
  const clientSource = readFileSync(clientPath, 'utf8');
  const clientLines = clientSource.split('\n').length;

  assert.ok(clientLines < 760, `expected BillingClient to stay under 760 lines, got ${clientLines}`);
  assert.match(clientSource, /from '\.\/WalletTopupPanel';/);
  assert.match(clientSource, /from '\.\/ReceiptsPanel';/);
  assert.match(clientSource, /from '\.\/BillingAuthGateModal';/);
  assert.match(clientSource, /from '\.\/BillingHero';/);
  assert.match(clientSource, /useBillingTopupAnalytics\(topupQuotes\)/);

  assert.doesNotMatch(clientSource, /function WalletExpressCheckout/);
  assert.doesNotMatch(clientSource, /function TurnstileChallenge/);
  assert.doesNotMatch(clientSource, /const DEFAULT_BILLING_COPY =/);
  assert.doesNotMatch(clientSource, /const GOOGLE_ADS_CONVERSION_TARGET/);
  assert.doesNotMatch(clientSource, /formatReceiptSurfaceLabel/);
});

test('billing feature modules own their explicit responsibilities', () => {
  const walletPanelSource = readFileSync(walletPanelPath, 'utf8');
  const receiptsPanelSource = readFileSync(receiptsPanelPath, 'utf8');
  const expressCheckoutSource = readFileSync(expressCheckoutPath, 'utf8');
  const analyticsHookSource = readFileSync(analyticsHookPath, 'utf8');
  const copySource = readFileSync(copyPath, 'utf8');
  const utilsSource = readFileSync(utilsPath, 'utf8');

  assert.match(walletPanelSource, /export function WalletTopupPanel/);
  assert.match(walletPanelSource, /<WalletExpressCheckout/);
  assert.match(walletPanelSource, /<TurnstileChallenge/);
  assert.match(receiptsPanelSource, /export function ReceiptsPanel/);
  assert.match(receiptsPanelSource, /formatReceiptSurfaceLabel/);
  assert.match(expressCheckoutSource, /export function WalletExpressCheckout/);
  assert.match(analyticsHookSource, /export function useBillingTopupAnalytics/);
  assert.match(analyticsHookSource, /topup_started/);
  assert.match(copySource, /export const DEFAULT_BILLING_COPY/);
  assert.match(utilsSource, /export function parseAmountToCents/);
});
