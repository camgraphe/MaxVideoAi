import assert from 'node:assert/strict';
import test from 'node:test';
import { getEditorialStatusLabel } from '../frontend/app/(core)/admin/editorial/_lib/editorial-status';

test('article status distinguishes approval, deployment and verified publication', () => {
  assert.equal(getEditorialStatusLabel(null, null), 'Draft version');
  assert.equal(getEditorialStatusLabel(null, '2026-09-22'), 'Approved · not published');
  assert.equal(getEditorialStatusLabel('awaiting-ci', '2026-09-22'), 'Checks in progress');
  assert.equal(getEditorialStatusLabel('awaiting-deployment', '2026-09-22'), 'Deployment in progress');
  assert.equal(getEditorialStatusLabel('published', '2026-09-22'), 'Published · verified');
  assert.equal(getEditorialStatusLabel('cancelled', '2026-09-22'), 'Publication cancelled');
  assert.equal(getEditorialStatusLabel('blocked', '2026-09-22'), 'Needs attention');
});
