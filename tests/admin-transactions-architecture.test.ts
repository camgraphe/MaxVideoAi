import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const modulesDir = join(root, 'frontend/server/admin-transactions');

function readModule(name: string) {
  return readFileSync(join(modulesDir, name), 'utf8');
}

test('admin transaction shared contracts live in focused modules', () => {
  for (const name of ['types.ts', 'normalizers.ts']) {
    assert.ok(existsSync(join(modulesDir, name)), `${name} should exist`);
    assert.ok(readModule(name).split('\n').length <= 350, `${name} should stay below 350 lines`);
  }

  assert.match(readModule('types.ts'), /export type AdminTransactionRecord/);
  assert.match(readModule('types.ts'), /export type TransactionAnomalies/);
  assert.match(readModule('normalizers.ts'), /export function coerceNumber/);
  assert.match(readModule('normalizers.ts'), /export function normalizeCurrency/);
  assert.match(readModule('normalizers.ts'), /export function isRefundablePaymentStatus/);
});
