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

test('admin transaction reads have one focused owner', () => {
  const source = readModule('read-model.ts');
  assert.ok(source.split('\n').length <= 350, 'read-model.ts should stay below 350 lines');
  assert.match(source, /export function mapAdminTransactionRow/);
  assert.match(source, /export async function fetchAdminTransactions/);
  assert.match(source, /export async function fetchTransactionAnomalies/);
});

test('manual top-ups have one focused owner', () => {
  const source = readModule('topups.ts');
  assert.ok(source.split('\n').length <= 350, 'topups.ts should stay below 350 lines');
  assert.match(source, /export async function issueManualWalletTopUp/);
  assert.doesNotMatch(source, /\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/);
});

test('refund commands use one focused real transaction owner', () => {
  const source = readModule('refunds.ts');
  assert.ok(source.split('\n').length <= 350, 'refunds.ts should stay below 350 lines');
  assert.match(source, /withDbTransaction/);
  assert.match(source, /QueryExecutor/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /export async function issueManualWalletRefund/);
  assert.match(source, /export async function issueManualWalletRefundByReceipt/);
  assert.doesNotMatch(source, /query\(['"]BEGIN|query\(['"]COMMIT|query\(['"]ROLLBACK/);
});

test('admin transactions public module is a thin stable facade', () => {
  const facadePath = join(root, 'frontend/server/admin-transactions.ts');
  const source = readFileSync(facadePath, 'utf8');
  assert.ok(source.split('\n').length <= 25, 'admin-transactions.ts should stay below 25 lines');
  for (const publicName of [
    'fetchAdminTransactions',
    'fetchTransactionAnomalies',
    'issueManualWalletRefund',
    'issueManualWalletRefundByReceipt',
    'issueManualWalletTopUp',
    'AdminTransactionRecord',
    'TransactionAnomalies',
  ]) {
    assert.match(source, new RegExp(publicName));
  }
  assert.doesNotMatch(source, /SELECT|INSERT|UPDATE|DATABASE_URL|coerceNumber|normalizeCurrency/);
});
