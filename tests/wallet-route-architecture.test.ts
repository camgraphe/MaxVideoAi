import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const routeSource = readFileSync(join(process.cwd(), 'frontend/app/api/wallet/route.ts'), 'utf8');

test('wallet GET delegates ledger aggregation to the shared wallet summary service', () => {
  assert.match(routeSource, /getWalletSummary/);
  assert.doesNotMatch(routeSource, /type WalletLedgerSummaryRow/);
  assert.doesNotMatch(routeSource, /SUM\(CASE WHEN type = 'topup'/);
  assert.doesNotMatch(routeSource, /STRING_AGG\(DISTINCT LOWER\(currency\)/);
});

test('wallet route keeps checkout mutation behavior while staying below its post-extraction cap', () => {
  assert.match(routeSource, /export async function POST/);
  assert.match(routeSource, /stripe\.checkout\.sessions\.create/);
  assert.ok(routeSource.split('\n').length <= 600);
});
