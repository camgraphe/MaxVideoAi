import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/src/server/fraud-cleanup.ts');
const modulesDir = join(root, 'frontend/src/server/fraud-cleanup');
const modules = [
  'apply-plan.ts',
  'candidates.ts',
  'constants.ts',
  'normalization.ts',
  'plan.ts',
  'restrictions.ts',
  'schema.ts',
  'stripe-status.ts',
  'types.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

test('fraud cleanup public module stays a route-facing orchestrator', () => {
  assert.match(facadeSource, /from '\.\/fraud-cleanup\/apply-plan'/);
  assert.match(facadeSource, /from '\.\/fraud-cleanup\/candidates'/);
  assert.match(facadeSource, /from '\.\/fraud-cleanup\/schema'/);
  assert.match(facadeSource, /from '\.\/fraud-cleanup\/plan'/);
  assert.match(facadeSource, /export async function runStripeFraudWalletCleanup/);
  assert.match(facadeSource, /export \{ RESTRICTED_ACCOUNT_MESSAGE \}/);
  assert.match(facadeSource, /export \{ buildRestrictedAccountPayload, getActiveAccountRestriction \}/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 60, `fraud-cleanup.ts should stay below 60 lines, got ${lineCount}`);
});

test('fraud cleanup responsibilities live in focused server modules', () => {
  for (const moduleName of modules) {
    const modulePath = join(modulesDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under fraud-cleanup`);
    const lineCount = readFileSync(modulePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 280, `${moduleName} should stay below 280 lines, got ${lineCount}`);
  }
});

test('fraud cleanup facade does not regain helper or SQL ownership', () => {
  for (const pattern of [
    /type RawTopupRow =/,
    /function coerceNumber\(/,
    /function normalizeCurrency\(/,
    /function fetchTopupRows\(/,
    /function fetchUserStats\(/,
    /function statusFromCharge\(/,
    /function resolveStripeStatus\(/,
    /function countFailedOrBlockedTopupAttempts\(/,
    /function insertFraudAudit\(/,
    /function applyFraudCleanupPlan\(/,
    /CREATE TABLE IF NOT EXISTS/,
    /CREATE UNIQUE INDEX IF NOT EXISTS/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});
