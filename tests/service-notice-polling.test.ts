import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { SERVICE_NOTICE_POLLING_INTERVAL_MS } from '../frontend/lib/service-notice-polling.ts';

test('service notice polling remains driven by the admin database route', () => {
  const headerSource = fs.readFileSync('frontend/components/HeaderBar.tsx', 'utf8');
  const routeSource = fs.readFileSync('frontend/app/api/service-notice/route.ts', 'utf8');

  assert.match(headerSource, /fetch\('\/api\/service-notice'\)/);
  assert.doesNotMatch(headerSource, /NEXT_PUBLIC_SERVICE_NOTICE_POLLING/);
  assert.match(routeSource, /getServiceNoticeSetting/);
});

test('service notice polling interval is five minutes', () => {
  assert.equal(SERVICE_NOTICE_POLLING_INTERVAL_MS, 300_000);
});
