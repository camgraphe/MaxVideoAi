import assert from 'node:assert/strict';
import test from 'node:test';
import { adminReportingWindow } from '../frontend/lib/admin/reporting-window';

test('Today begins at midnight Madrid, not midnight UTC or rolling 24 hours', () => {
  assert.equal(adminReportingWindow('today', new Date('2026-09-22T16:00:00Z')).from, '2026-09-21T22:00:00.000Z');
  assert.equal(adminReportingWindow('24h', new Date('2026-09-22T16:00:00Z')).from, '2026-09-21T16:00:00.000Z');
});
test('Madrid midnight uses the offset at midnight across both DST transitions', () => {
  assert.equal(adminReportingWindow('today', new Date('2026-03-29T18:00:00Z')).from, '2026-03-28T23:00:00.000Z');
  assert.equal(adminReportingWindow('today', new Date('2026-10-25T18:00:00Z')).from, '2026-10-24T22:00:00.000Z');
  assert.equal(adminReportingWindow('today', new Date('2026-01-01T00:01:00Z')).from, '2025-12-31T23:00:00.000Z');
});
