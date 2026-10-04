import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ADMIN_EXCLUDED_USER_IDS, resolveExcludeAdminParam } from '../frontend/lib/admin/exclusions.ts';
import { manualAdminCreditExclusionClause } from '../frontend/server/admin-metrics/admin-topup-filter.ts';
import { scanRegistrations } from '../frontend/server/admin-overview-read.ts';

const main = readFileSync('frontend/server/admin-metrics/admin-metrics-main.ts', 'utf8');
const comparison = readFileSync('frontend/server/admin-metrics/admin-metrics-comparison.ts', 'utf8');
const overview = readFileSync('frontend/server/admin-overview.ts', 'utf8');
const dashboardPage = readFileSync('frontend/app/(core)/admin/page.tsx', 'utf8');
const insightsPage = readFileSync('frontend/app/(core)/admin/insights/page.tsx', 'utf8');

test('the default customer view excludes Camgraph and retains a full-view option', () => {
  assert.equal(resolveExcludeAdminParam(undefined), true);
  assert.equal(resolveExcludeAdminParam('0'), false);
  assert.ok(ADMIN_EXCLUDED_USER_IDS.includes('301cc489-d689-477f-94c4-0b051deda0bc'));
  assert.match(dashboardPage, /resolveExcludeAdminParam\(params\?\.excludeAdmin\)/);
  assert.match(insightsPage, /excludeUserIds: excludeAdmin \? ADMIN_EXCLUDED_USER_IDS : \[\]/);
  assert.match(insightsPage, /excludeManualAdminTopups: excludeAdmin/);
});

test('manual admin credits are excluded from every Insights top-up aggregate', () => {
  assert.equal(
    manualAdminCreditExclusionClause(true),
    "AND (type <> 'topup' OR COALESCE(metadata ->> 'reason', '') <> 'manual_admin_topup')"
  );
  assert.equal(manualAdminCreditExclusionClause(false), '');
  for (const source of [main, comparison]) {
    const topupPredicates = source.match(/WHERE type = 'topup'/g) ?? [];
    const filteredPredicates = source.match(/WHERE type = 'topup' \$\{excludeManualTopupsClause\}/g) ?? [];
    assert.ok(topupPredicates.length > 0);
    assert.equal(filteredPredicates.length, topupPredicates.length);
  }
});

test('overview filters totals, recent activity and job failures with the same scope', () => {
  assert.match(overview, /const excludedUserIds = excludeInternal \? ADMIN_EXCLUDED_USER_IDS : \[\]/);
  assert.match(overview, /manualAdminCreditExclusionClause\(excludeInternal\)/);
  assert.equal((overview.match(/\$\{manualCreditClause\}/g) ?? []).length, 2);
  assert.equal((overview.match(/<> ALL\(\$3::text\[\]\)/g) ?? []).length, 3);
});

test('registration scan excludes the internal account without changing pagination', async () => {
  const users = [
    { id: ADMIN_EXCLUDED_USER_IDS[0], email: 'internal@example.test', created_at: '2026-09-25T10:00:00.000Z' },
    { id: 'customer-1', email: 'customer@example.test', created_at: '2026-09-25T11:00:00.000Z' },
  ];
  const listUsers = async () => users;
  const from = '2026-09-25T00:00:00.000Z';
  const to = '2026-09-26T00:00:00.000Z';
  const signal = new AbortController().signal;
  const filtered = await scanRegistrations(from, to, signal, listUsers, new Set(ADMIN_EXCLUDED_USER_IDS));
  const full = await scanRegistrations(from, to, signal, listUsers);
  assert.equal(filtered.count, 1);
  assert.deepEqual(filtered.recent.map((user) => user.id), ['customer-1']);
  assert.equal(full.count, 2);
});
