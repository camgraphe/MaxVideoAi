import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { AdminTransactionRecord } from '../frontend/server/admin-transactions/types';

// Real table/components; only Next's route context is replaced. No mutation is invoked.
const table = build({
  stdin: { contents: "export { AdminTransactionTable } from './frontend/components/admin/TransactionTable';", resolveDir: process.cwd() },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  tsconfig: 'frontend/tsconfig.json', external: ['react', 'react/jsx-runtime', 'react-dom', 'next/image'],
  plugins: [{ name: 'next-route-context', setup(builder) {
    builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'route-context' }));
    builder.onLoad({ filter: /.*/, namespace: 'route-context' }, args => ({ contents: args.path.endsWith('navigation')
      ? "export const useRouter=()=>({push(){},refresh(){}});export const useSearchParams=()=>new URLSearchParams('receipt=10');"
      : "import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children)}" }));
  } }],
}).then(result => {
  const module = { exports: {} as { AdminTransactionTable: typeof import('../frontend/components/admin/TransactionTable').AdminTransactionTable } };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports.AdminTransactionTable;
});
function receipt(overrides: Partial<AdminTransactionRecord> = {}): AdminTransactionRecord {
  return {
    receiptId: 10, userId: 'synthetic-account', userEmail: null, type: 'charge', amountCents: 500, currency: 'USD',
    description: 'Synthetic purchase', refundReason: null, billingProductKey: null, jobId: null,
    jobStatus: null, jobPaymentStatus: null, jobEngineLabel: null, jobVideoUrl: null, jobDurationSec: null,
    isMcpGeneration: false, mcpClientFamily: null, isStudioGeneration: false, isCreateGeneration: false, confirmationPlatform: null, jobCreatedAt: null, jobProgress: null, jobMessage: null,
    createdAt: '2026-09-22T10:00:00Z', hasRefund: false, latestChargeId: 10, isLatestCharge: true,
    canRefund: true, ...overrides,
  };
}
async function render(row: AdminTransactionRecord) {
  const html = renderToStaticMarkup(React.createElement(await table, {
    initialTransactions: [row], filters: { period: 'all', type: 'all', query: '', limit: 50 },
    nextCursor: null, initialReceipt: row,
  }));
  return new JSDOM(html);
}

test('actual admin table names product-only and prefix-only packs without a media refund affordance', async () => {
  for (const identity of [
    { billingProductKey: 'studio_assistance_pack', jobId: null },
    { billingProductKey: 'studio_assistance_pack', jobId: 'product-reference' },
    { billingProductKey: null, jobId: 'studio-sol-pack:synthetic-pack' },
  ]) {
    const dom = await render(receipt(identity));
    try {
      const document = dom.window.document;
      const row = document.querySelector('tbody tr')!;
      assert.match(row.querySelectorAll('td')[3].textContent!, /Milo credit pack/);
      assert.equal(row.querySelectorAll('td')[4].textContent!.trim(), 'Recorded');
      const details = document.querySelector('aside')!;
      assert.match(details.textContent!, /Milo credit pack/);
      assert.doesNotMatch(details.textContent!, /Linked generation|Job record missing|Refund tokens/);
      assert.equal(details.querySelector('a[href^="/admin/jobs"]'), null);
      if (identity.jobId) assert.match(details.textContent!, new RegExp(identity.jobId));
    } finally { dom.window.close(); }
  }
});
test('pack product identity takes precedence over incidental media-origin flags', async () => {
  const dom = await render(receipt({ billingProductKey: 'studio_assistance_pack', isMcpGeneration: true, isStudioGeneration: true }));
  try {
    assert.match(dom.window.document.querySelector('tbody')!.textContent!, /Milo credit pack/);
    assert.doesNotMatch(dom.window.document.querySelector('tbody')!.textContent!, /Studio|MCP/);
  } finally { dom.window.close(); }
});
test('real media keeps its model, duration, MCP origin, generation link and refund action', async () => {
  const dom = await render(receipt({ jobId: 'synthetic-media', jobStatus: 'completed', jobPaymentStatus: 'paid_wallet',
    jobEngineLabel: 'Veo', jobDurationSec: 8, isMcpGeneration: true }));
  try {
    const document = dom.window.document;
    assert.match(document.querySelector('tbody')!.textContent!, /Veo.*8\s*s/s);
    assert.match(document.querySelector('tbody')!.textContent!, /MCP/);
    assert.doesNotMatch(document.querySelector('tbody')!.textContent!, /Needs review|Milo credit pack/);
    assert.equal(document.querySelector('aside a[href^="/admin/jobs"]')?.getAttribute('href'), '/admin/jobs?jobId=synthetic-media');
    assert.ok([...document.querySelectorAll('button')].some(button => button.textContent === 'Refund tokens'));
  } finally { dom.window.close(); }
});

test('generation badges identify the native confirmation platform accessibly when known', async () => {
  for (const [source, platform, label] of [['Studio','ios','Confirmed in the iOS app'],
    ['Create','android','Confirmed in the Android app'], ['Studio',null,null], ['Create',null,null]] as const) {
    const dom = await render(receipt({isStudioGeneration:source==='Studio',isCreateGeneration:source==='Create',
      confirmationPlatform:platform, jobId:'example-render'}));
    const badge = dom.window.document.querySelector('tbody [title="Generation submitted from ' + source + '"]')!;
    assert.ok(badge?.textContent?.includes(source));
    assert.equal(badge.querySelector('svg[role="img"]')?.getAttribute('aria-label') ?? null, label);
  }
});

test('ChatGPT receipts and refunds show the mark in the row and inspector', async () => {
  for (const [type, family, expectedLabel] of [
    ['charge', 'chatgpt', 'ChatGPT'],
    ['refund', 'chatgpt', 'ChatGPT'],
    ['charge', 'codex', 'MCP'],
    ['charge', null, 'MCP'],
  ] as const) {
    const dom = await render(receipt({ type, isMcpGeneration: true, mcpClientFamily: family }));
    try {
      const document = dom.window.document;
      for (const root of ['tbody', 'aside']) {
        const badge = document.querySelector(`${root} [title^="Generation "]`);
        assert.equal(badge?.textContent, expectedLabel);
        assert.equal(Boolean(badge?.querySelector('[data-mcp-integration-mark="chatgpt"]')), family === 'chatgpt');
      }
    } finally { dom.window.close(); }
  }
});
