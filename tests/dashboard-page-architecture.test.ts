import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('the retired dashboard keeps old links valid by redirecting to Create', () => {
  const source = readFileSync(
    join(process.cwd(), 'frontend/app/(core)/dashboard/page.tsx'),
    'utf8'
  );

  assert.match(source, /redirect\('\/app'\)/);
  assert.doesNotMatch(source, /use client|useInfiniteJobs|DashboardPageShell/);
});
