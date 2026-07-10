import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/billing/page.tsx';
const clientPath = 'frontend/app/(core)/billing/_components/BillingClient.tsx';
const authGatePath = 'frontend/app/(core)/billing/_components/BillingAuthGateModal.tsx';
const walletPanelPath = 'frontend/app/(core)/billing/_components/WalletTopupPanel.tsx';
const receiptsPanelPath = 'frontend/app/(core)/billing/_components/ReceiptsPanel.tsx';
const expressCheckoutPath = 'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx';
const currencyHookPath = 'frontend/app/(core)/billing/_hooks/useBillingCurrencyState.ts';
const receiptsHookPath = 'frontend/app/(core)/billing/_hooks/useBillingReceipts.ts';
const sessionHookPath = 'frontend/app/(core)/billing/_hooks/useBillingSessionState.ts';
const analyticsHookPath = 'frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts';
const quotesHookPath = 'frontend/app/(core)/billing/_hooks/useBillingTopupQuotes.ts';
const topupSelectionHookPath = 'frontend/app/(core)/billing/_hooks/useBillingTopupSelection.ts';
const copyPath = 'frontend/app/(core)/billing/_lib/billing-copy.ts';
const intentPath = 'frontend/app/(core)/billing/_lib/billing-intent.ts';
const typesPath = 'frontend/app/(core)/billing/_lib/billing-types.ts';
const utilsPath = 'frontend/app/(core)/billing/_lib/billing-utils.ts';
const accessibleModalHookPath = 'frontend/components/ui/useAccessibleModal.ts';
const hostedCheckoutHookPath = 'frontend/hooks/useHostedWalletCheckout.ts';
const checkoutReturnNoticePath = 'frontend/app/(core)/billing/_components/BillingCheckoutReturnNotice.tsx';

test('billing page delegates client billing behavior to route-local modules', () => {
  for (const file of [
    clientPath,
    authGatePath,
    walletPanelPath,
    receiptsPanelPath,
    expressCheckoutPath,
    currencyHookPath,
    receiptsHookPath,
    sessionHookPath,
    analyticsHookPath,
    quotesHookPath,
    topupSelectionHookPath,
    copyPath,
    intentPath,
    typesPath,
    utilsPath,
    accessibleModalHookPath,
    hostedCheckoutHookPath,
    checkoutReturnNoticePath,
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

  assert.ok(clientLines < 450, `expected BillingClient to stay under 450 lines, got ${clientLines}`);
  assert.match(clientSource, /from '\.\/WalletTopupPanel';/);
  assert.match(clientSource, /from '\.\/ReceiptsPanel';/);
  assert.match(clientSource, /from '\.\/BillingAuthGateModal';/);
  assert.match(clientSource, /from '\.\/BillingHero';/);
  assert.match(clientSource, /useBillingCurrencyState\(\{/);
  assert.match(clientSource, /useBillingReceipts\(\{/);
  assert.match(clientSource, /useBillingSessionState\(\{/);
  assert.match(clientSource, /useBillingTopupQuotes\(\{/);
  assert.match(clientSource, /useBillingTopupAnalytics\(topupQuotes\)/);
  assert.match(clientSource, /useBillingTopupSelection\(\{/);
  assert.match(clientSource, /useHostedWalletCheckout\(\{/);
  assert.match(
    clientSource,
    /function handleTopUp\(\) \{[\s\S]*?setToast\(null\);[\s\S]*?hostedCheckout\.startCheckout\(\);/,
    'a new Billing hosted attempt should clear its visible hosted-checkout toast'
  );
  assert.match(clientSource, /checkoutCaptchaResetGeneration=\{hostedCheckout\.captchaResetGeneration\}/);
  assert.match(clientSource, /<BillingCheckoutReturnNotice/);

  assert.doesNotMatch(clientSource, /function WalletExpressCheckout/);
  assert.doesNotMatch(clientSource, /function TurnstileChallenge/);
  assert.doesNotMatch(clientSource, /const DEFAULT_BILLING_COPY =/);
  assert.doesNotMatch(clientSource, /const GOOGLE_ADS_CONVERSION_TARGET/);
  assert.doesNotMatch(clientSource, /\/api\/me\/currency/);
  assert.doesNotMatch(clientSource, /formatReceiptSurfaceLabel/);
  assert.doesNotMatch(clientSource, /\/api\/receipts/);
  assert.doesNotMatch(clientSource, /\/api\/topup\/quote/);
  assert.doesNotMatch(clientSource, /\/api\/member-status/);
  assert.doesNotMatch(clientSource, /\/api\/stripe-mode/);
  assert.doesNotMatch(clientSource, /writeLastKnown/);
  assert.doesNotMatch(clientSource, /readLastKnownUserId/);
  assert.doesNotMatch(clientSource, /ReceiptItem/);
  assert.doesNotMatch(clientSource, /userCurrencyOverrideRef/);
  assert.doesNotMatch(clientSource, /parseAmountToCents/);
  assert.doesNotMatch(clientSource, /USD_TOPUP_TIERS/);
  assert.doesNotMatch(clientSource, /fetch\('\/api\/wallet'/);
  assert.doesNotMatch(clientSource, /const \[checkoutCaptchaRequired, setCheckoutCaptchaRequired\]/);
});

test('billing feature modules own their explicit responsibilities', () => {
  const authGateSource = readFileSync(authGatePath, 'utf8');
  const accessibleModalHookSource = readFileSync(accessibleModalHookPath, 'utf8');
  const intentSource = readFileSync(intentPath, 'utf8');
  const clientSource = readFileSync(clientPath, 'utf8');
  const walletPanelSource = readFileSync(walletPanelPath, 'utf8');
  const receiptsPanelSource = readFileSync(receiptsPanelPath, 'utf8');
  const expressCheckoutSource = readFileSync(expressCheckoutPath, 'utf8');
  const currencyHookSource = readFileSync(currencyHookPath, 'utf8');
  const receiptsHookSource = readFileSync(receiptsHookPath, 'utf8');
  const sessionHookSource = readFileSync(sessionHookPath, 'utf8');
  const analyticsHookSource = readFileSync(analyticsHookPath, 'utf8');
  const quotesHookSource = readFileSync(quotesHookPath, 'utf8');
  const topupSelectionHookSource = readFileSync(topupSelectionHookPath, 'utf8');
  const copySource = readFileSync(copyPath, 'utf8');
  const utilsSource = readFileSync(utilsPath, 'utf8');

  assert.match(accessibleModalHookSource, /export function useAccessibleModal/);
  assert.match(authGateSource, /from '@\/components\/ui\/useAccessibleModal';/);

  assert.match(walletPanelSource, /export function WalletTopupPanel/);
  assert.match(walletPanelSource, /<WalletExpressCheckout/);
  assert.match(walletPanelSource, /<TurnstileChallenge/);
  assert.match(receiptsPanelSource, /export function ReceiptsPanel/);
  assert.match(receiptsPanelSource, /formatReceiptSurfaceLabel/);
  assert.match(expressCheckoutSource, /export function WalletExpressCheckout/);
  assert.match(currencyHookSource, /export function useBillingCurrencyState/);
  assert.match(currencyHookSource, /\/api\/me\/currency/);
  assert.match(currencyHookSource, /userCurrencyOverrideRef/);
  assert.match(receiptsHookSource, /export function useBillingReceipts/);
  assert.match(receiptsHookSource, /\/api\/receipts/);
  assert.match(receiptsHookSource, /exportCSV/);
  assert.match(receiptsHookSource, /receiptsCollapsed/);
  assert.match(sessionHookSource, /export function useBillingSessionState/);
  assert.match(sessionHookSource, /\/api\/wallet/);
  assert.match(sessionHookSource, /\/api\/member-status\?includeTiers=1/);
  assert.match(sessionHookSource, /\/api\/stripe-mode/);
  assert.match(sessionHookSource, /writeLastKnownWallet/);
  assert.match(sessionHookSource, /writeLastKnownMember/);
  assert.match(analyticsHookSource, /export function useBillingTopupAnalytics/);
  assert.match(analyticsHookSource, /topup_started/);
  assert.match(quotesHookSource, /export function useBillingTopupQuotes/);
  assert.match(quotesHookSource, /\/api\/topup\/quote/);
  assert.match(quotesHookSource, /USD_TOPUP_TIERS/);
  assert.match(topupSelectionHookSource, /export function useBillingTopupSelection/);
  assert.match(topupSelectionHookSource, /parseAmountToCents/);
  assert.match(topupSelectionHookSource, /USD_TOPUP_TIERS/);
  assert.match(copySource, /export const DEFAULT_BILLING_COPY/);
  assert.match(intentSource, /export function parseBillingIntent/);
  assert.match(intentSource, /export function buildBillingIntentTarget/);
  assert.match(clientSource, /from '\.\.\/_lib\/billing-intent';/);
  assert.match(utilsSource, /export function parseAmountToCents/);
});
