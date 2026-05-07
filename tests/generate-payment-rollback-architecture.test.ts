import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/payment-rollback.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates payment rollback helpers', () => {
  assert.ok(existsSync(helperPath), 'payment rollback helpers should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/payment-rollback'/);

  for (const implementationName of [
    'recordRefundReceipt',
    'issueStripeRefund',
    'rollbackPendingPayment',
  ]) {
    assert.doesNotMatch(
      routeSource,
      new RegExp(`function ${implementationName}\\(`),
      `${implementationName} belongs in payment-rollback.ts`
    );
  }

  assert.doesNotMatch(routeSource, /stripe\.refunds\.create/, 'Stripe refund creation belongs in payment-rollback.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2500, `/api/generate route should stay below 2500 lines after payment rollback extraction, got ${lineCount}`);
});

test('payment rollback helper exposes the route contract', () => {
  assert.match(helperSource, /export async function recordRefundReceipt/, 'recordRefundReceipt should be exported');
  assert.match(helperSource, /export async function rollbackPendingPayment/, 'rollbackPendingPayment should be exported');
  assert.match(helperSource, /async function issueStripeRefund/, 'Stripe refund issue helper should stay private');
  assert.match(helperSource, /receiptsPriceOnlyEnabled/, 'refund receipts should preserve price-only behavior');
  assert.match(helperSource, /stripe\.refunds\.create/, 'Stripe refund creation should live with rollback');
  assert.match(helperSource, /INSERT INTO app_receipts/, 'refund receipt insert should live with rollback');
});
