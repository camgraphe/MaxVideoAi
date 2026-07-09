import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controllerSource = readFileSync(
  'frontend/app/(core)/login/_hooks/useLoginPageController.ts',
  'utf8'
);

test('immediate password signup preserves the resolved return target', () => {
  assert.doesNotMatch(controllerSource, /const target = sanitizeNextPath\('\/generate'\)/);
  assert.match(
    controllerSource,
    /persistPendingAnalyticsEvent\('sign_up_completed',[\s\S]*completeAuthenticatedRedirect\(safeNextPath,\s*data\.session\.user\?\.id/
  );
});
