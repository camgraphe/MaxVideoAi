import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldUseStarterFallback } from '../frontend/src/lib/jobs-feed-policy';

test('image feed does not use starter fallback on first page', () => {
  assert.equal(shouldUseStarterFallback('image', null), false);
});

test('video feed uses starter fallback on first page', () => {
  assert.equal(shouldUseStarterFallback('video', null), true);
});

test('feed with cursor never uses starter fallback', () => {
  assert.equal(shouldUseStarterFallback('video', '2026-02-16T12:00:00.000Z|42'), false);
  assert.equal(shouldUseStarterFallback('image', '2026-02-16T12:00:00.000Z|42'), false);
  assert.equal(shouldUseStarterFallback('all', '2026-02-16T12:00:00.000Z|42'), false);
});
