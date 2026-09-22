import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const page = readFileSync('frontend/app/(core)/admin/page.tsx', 'utf8');
const view = readFileSync('frontend/app/(core)/admin/_components/AdminDashboardView.tsx', 'utf8');
const boundedReads = readFileSync('frontend/server/admin-overview-read.ts', 'utf8');
const loader = readFileSync('frontend/server/admin-overview.ts', 'utf8');
test('overview route authorizes and delegates read-only reporting', () => {
  assert.match(page, /await requireAdmin\(\)/);
  assert.match(page, /fetchAdminOverview/);
  assert.match(page, /<AdminDashboardView/);
  assert.ok(page.split('\n').length < 60);
  assert.doesNotMatch(page, /<table|<header|SELECT/);
});
test('overview uses bounded reads and represents unavailable measurements honestly', () => {
  assert.match(loader, /adminReportingWindow/);
  assert.match(boundedReads, /catch\(\(\) => null\)/);
  assert.match(boundedReads, /page <= 100/);
  assert.doesNotMatch(loader, /ensure.*Schema|INSERT INTO|UPDATE |DELETE FROM/);
  assert.match(view, /Unavailable/);
  assert.match(view, /Europe\/Madrid/);
  assert.doesNotMatch(view, /buildUtilizationScore|buildSystemRows|MonthlyStatsChart|Live sync/);
});

test('admin shell does not load or poll health for removed navigation badges', () => {
  const layout = readFileSync('frontend/app/(core)/admin/layout.tsx', 'utf8');
  const shell = readFileSync('frontend/components/admin/AdminShell.tsx', 'utf8');
  assert.match(layout, /await requireAdmin/);
  assert.doesNotMatch(layout, /fetchAdminHealth|loadAdminBadges/);
  assert.doesNotMatch(shell, /api\/admin\/health|useSWR/);
});
