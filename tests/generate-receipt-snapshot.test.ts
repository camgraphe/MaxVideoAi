import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildReceiptSnapshot } from '../frontend/app/api/generate/_lib/receipt-snapshot';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/receipt-snapshot.ts');
const billingHelperPath = join(root, 'frontend/app/api/generate/_lib/billing-preflight.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');
const billingHelperSource = existsSync(billingHelperPath) ? readFileSync(billingHelperPath, 'utf8') : '';

test('generate route delegates receipt snapshot building', () => {
  assert.ok(existsSync(helperPath), 'receipt snapshot building should live in the generate route _lib folder');
  assert.match(
    `${routeSource}\n${billingHelperSource}`,
    /from '\.\/receipt-snapshot'|from '\.\/_lib\/receipt-snapshot'/,
    'receipt snapshot helper should be imported by the route or its billing preflight helper'
  );
  assert.doesNotMatch(routeSource, /function buildReceiptSnapshot/, 'receipt snapshot construction belongs in receipt-snapshot.ts');
  assert.doesNotMatch(routeSource, /discountCandidate/, 'discount pruning belongs in receipt-snapshot.ts');
  assert.doesNotMatch(routeSource, /taxesCandidate/, 'tax pruning belongs in receipt-snapshot.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2130, `/api/generate route should stay below 2130 lines after receipt snapshot extraction, got ${lineCount}`);
});

test('receipt snapshot helper exposes the route contract', () => {
  assert.match(helperSource, /export function buildReceiptSnapshot/, 'buildReceiptSnapshot should be exported');
  assert.match(helperSource, /type DiscountCandidate/, 'discount shape should stay with receipt snapshot logic');
  assert.match(helperSource, /type TaxCandidate/, 'tax shape should stay with receipt snapshot logic');
});

test('receipt snapshot helper keeps price-only receipt fields and prunes empty adjustments', () => {
  const snapshot = buildReceiptSnapshot({
    totalCents: 1200,
    currency: 'USD',
    discount: {
      amountCents: 300,
      percentApplied: 20,
      label: 'Launch',
    },
    taxes: [
      { amountCents: 0, label: 'Ignored' },
      { amountCents: 75, label: 'VAT' },
      { amountCents: 25 },
    ],
  } as never);

  assert.deepEqual(snapshot, {
    totalCents: 1200,
    currency: 'USD',
    discount: {
      amountCents: 300,
      percentApplied: 20,
      label: 'Launch',
    },
    taxes: [
      { amountCents: 75, label: 'VAT' },
      { amountCents: 25, label: null },
    ],
  });
});

test('receipt snapshot helper omits non-positive discount and tax details', () => {
  const snapshot = buildReceiptSnapshot({
    totalCents: 900,
    currency: 'EUR',
    discount: {
      amountCents: 0,
      percentApplied: 0,
      label: 'None',
    },
    taxes: [{ amountCents: -10, label: 'Invalid' }],
  } as never);

  assert.deepEqual(snapshot, {
    totalCents: 900,
    currency: 'EUR',
  });
});
