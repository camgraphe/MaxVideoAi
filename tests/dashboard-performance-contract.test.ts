import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('dashboard recent renders load a small first page', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/dashboard/page.tsx'),
    'utf8'
  );

  assert.match(source, /const\s+DASHBOARD_RECENT_PAGE_SIZE\s*=\s*12/);
  assert.match(source, /useInfiniteJobs\(DASHBOARD_RECENT_PAGE_SIZE,\s*recentFeedOptions\)/);
});
