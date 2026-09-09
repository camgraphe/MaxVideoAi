import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const exportsSummarySource = readFileSync(
  'frontend/app/api/user/exports/summary/route.ts',
  'utf8',
);
const mediaAwarePreflightSource = readFileSync(
  'frontend/app/api/preflight/_lib/media-aware-preflight.ts',
  'utf8',
);

test('exports summary reads migrated tables without global schema bootstrap', () => {
  assert.doesNotMatch(exportsSummarySource, /ensureBillingSchema/);
  assert.match(
    exportsSummarySource,
    /ensureUserPreferences\(userId\)/,
    'the per-user onboarding initialization remains part of the route contract',
  );
});

test('Billing GETs read migrated tables and preserve currency POST initialization', () => {
  const currency = readFileSync('frontend/app/api/me/currency/route.ts', 'utf8');
  const receipts = readFileSync('frontend/app/api/receipts/route.ts', 'utf8');
  const [get, post] = currency.split('export async function POST');
  assert.doesNotMatch(get, /await ensureBillingSchema/);
  assert.match(post, /await ensureBillingSchema/);
  assert.doesNotMatch(receipts, /ensureBillingSchema/);
  assert.match(get, /getUserPreferredCurrency\(userId, \{ throwOnError: true \}\)/);
  assert.match(get, /getWalletBalancesByCurrency\(userId, \{ throwOnError: true \}\)/);
});

test('pricing preflight uses the read-only engine catalog and disables fallback bootstrap', () => {
  assert.match(
    mediaAwarePreflightSource,
    /from '@\/server\/agent-api\/read-only-engine-catalog'/,
  );
  assert.doesNotMatch(mediaAwarePreflightSource, /getConfiguredEngine,/);
  assert.doesNotMatch(mediaAwarePreflightSource, /getConfiguredEngineIncludingHidden,/);
  assert.match(mediaAwarePreflightSource, /bootstrap:\s*false/);
});

test('seed writer and read-only preflight share a pure system-defaults projection', () => {
  const defaults = readFileSync('frontend/src/server/engine-settings-defaults.ts', 'utf8');
  const writer = readFileSync('frontend/src/server/engine-settings.ts', 'utf8');
  const catalog = readFileSync('frontend/src/server/agent-api/read-only-engine-catalog.ts', 'utf8');
  const preflight = readFileSync('frontend/src/server/engines.ts', 'utf8');
  assert.match(writer, /from '@\/server\/engine-settings-defaults'/);
  assert.match(catalog, /from '@\/server\/engine-settings-defaults'/);
  assert.doesNotMatch(defaults, /\b(?:async|await|query|process)\b/);
  assert.match(preflight, /if \(bootstrap\) return getConfiguredEngine\(engineId, includeDisabled\);\s*return getReadOnlyConfiguredEngine\(engineId, includeDisabled\);/);
});
