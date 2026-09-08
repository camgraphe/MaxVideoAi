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

test('pricing preflight uses the read-only engine catalog and disables fallback bootstrap', () => {
  assert.match(
    mediaAwarePreflightSource,
    /from '@\/server\/agent-api\/read-only-engine-catalog'/,
  );
  assert.doesNotMatch(mediaAwarePreflightSource, /getConfiguredEngine,/);
  assert.doesNotMatch(mediaAwarePreflightSource, /getConfiguredEngineIncludingHidden,/);
  assert.match(mediaAwarePreflightSource, /bootstrap:\s*false/);
});
