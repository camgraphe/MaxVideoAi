import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { DEFAULT_BILLING_COPY } from '../frontend/app/(core)/billing/_lib/billing-copy';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

async function loadBillingPresentation() {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => {
    const classes = new Proxy({}, { get: (_target, property) => String(property) });
    module.exports = { __esModule: true, default: classes };
  };
  try {
    const [{ BillingWalletOverview }, { WalletCheckoutSummary }, { ReceiptsPanel }] = await Promise.all([
      import('../frontend/app/(core)/billing/_components/BillingWalletOverview'),
      import('../frontend/app/(core)/billing/_components/WalletCheckoutSummary'),
      import('../frontend/app/(core)/billing/_components/ReceiptsPanel'),
    ]);
    return { BillingWalletOverview, WalletCheckoutSummary, ReceiptsPanel };
  } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
}

test('wallet overview makes the available balance and refresh action explicit', async () => {
  const { BillingWalletOverview } = await loadBillingPresentation();
  const markup = renderToStaticMarkup(React.createElement(BillingWalletOverview, {
    copy: DEFAULT_BILLING_COPY,
    stripeMode: 'test',
    wallet: { balance: 42.5, currency: 'USD' },
    walletStatus: 'ready',
    onRefresh() {},
  }));
  const document = new JSDOM(markup).window.document;

  assert.match(document.querySelector('[data-wallet-balance]')?.textContent ?? '', /\$42\.50/);
  assert.equal(
    document.querySelector('button')?.textContent?.trim(),
    DEFAULT_BILLING_COPY.wallet.refreshBalance,
  );
  assert.match(document.body.textContent ?? '', new RegExp(DEFAULT_BILLING_COPY.hero.testMode));
});

test('checkout summary separates the quoted payment from USD wallet credits', async () => {
  const { WalletCheckoutSummary } = await loadBillingPresentation();
  const markup = renderToStaticMarkup(React.createElement(WalletCheckoutSummary, {
    copy: DEFAULT_BILLING_COPY,
    creditsLabel: '$25',
    paymentAmountLabel: '€23.10',
    quoteLoading: false,
    quoteError: null,
    isTopupStarting: false,
    onCheckout() {},
  }));
  const document = new JSDOM(markup).window.document;
  const rows = Array.from(document.querySelectorAll('dl > div')).map((row) => row.textContent?.trim());

  assert.deepEqual(rows.slice(0, 2), [
    `${DEFAULT_BILLING_COPY.wallet.paymentAmount}€23.10`,
    `${DEFAULT_BILLING_COPY.wallet.creditsReceived}$25`,
  ]);
  assert.match(
    document.querySelector('button')?.textContent ?? '',
    /Continue to secure Stripe Checkout/,
  );
});

test('billing copy exposes the paid-versus-received distinction in every locale', () => {
  for (const locale of ['en', 'fr', 'es']) {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    const wallet = dictionary.workspace.billing.wallet;
    assert.equal(typeof wallet.paymentAmount, 'string');
    assert.ok(wallet.paymentAmount.length > 0);
    assert.equal(typeof wallet.creditsReceived, 'string');
    assert.ok(wallet.creditsReceived.length > 0);
    assert.notEqual(wallet.paymentAmount, wallet.creditsReceived);
  }
});

test('payment history renders ledger movements with expandable document details', async () => {
  const { ReceiptsPanel } = await loadBillingPresentation();
  const markup = renderToStaticMarkup(React.createElement(ReceiptsPanel, {
    copy: DEFAULT_BILLING_COPY,
    dateFormatter: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' }),
    formatMoney: (amountCents: number, currency: string) => `${currency} ${(amountCents / 100).toFixed(2)}`,
    onExportCsv() {},
    onLoadMoreReceipts() {},
    onToggleReceipts() {},
    receipts: { items: [], nextCursor: null, loading: false, error: null },
    receiptsCollapsed: false,
    visibleReceipts: [{
      id: 7,
      type: 'topup',
      amount_cents: 2500,
      currency: 'USD',
      description: 'Wallet top-up',
      created_at: '2026-09-08T09:30:00.000Z',
      job_id: null,
      tax_amount_cents: null,
      discount_amount_cents: null,
      document_type: 'receipt',
      document_label: 'Stripe receipt',
      document_url: 'https://pay.example.test/receipt/7',
    }],
  }));
  const document = new JSDOM(markup).window.document;

  assert.equal(document.querySelectorAll('details').length, 1);
  assert.match(document.querySelector('summary')?.textContent ?? '', /USD 25\.00/);
  assert.equal(document.querySelector('a[href="https://pay.example.test/receipt/7"]')?.getAttribute('target'), '_blank');
});

test('billing local styles preserve touch targets and reduced-motion behavior', () => {
  const styles = [
    'frontend/app/(core)/billing/_components/billing-layout.module.css',
    'frontend/app/(core)/billing/_components/billing-topup.module.css',
    'frontend/app/(core)/billing/_components/billing-receipts.module.css',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');

  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
