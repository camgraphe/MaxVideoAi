import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIncidentRows } from '../frontend/app/(core)/admin/_lib/admin-dashboard-helpers';

test('provider credit failures stay visible when all jobs succeeded through fallback', () => {
  const rows = buildIncidentRows({
    engineStats: [], stalePendingJobs: 0, failedRenders24h: 0, refundedFailures24h: 0,
    serviceNotice: { active: false, message: null },
    providerCreditFailures24h: [{ provider: 'kling_direct', count: 14, lastFailureAt: '2026-09-21T10:52:32Z' }],
  }, { health: { failedRenders30d: 0 } } as never, '30d' as never);
  assert.match(rows[0].label, /kling_direct.*14.*provider.*credit/i);
  assert.equal(rows[0].status, 'Warning');
  assert.doesNotMatch(rows.map(r => r.label).join(' '), /No unresolved render incidents/);
});
