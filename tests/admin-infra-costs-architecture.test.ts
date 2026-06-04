import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/infra-costs/page.tsx');
const viewPath = join(root, 'frontend/app/(core)/admin/infra-costs/_components/AdminInfraCostsView.tsx');
const formatPath = join(root, 'frontend/app/(core)/admin/infra-costs/_lib/admin-infra-costs-format.ts');
const serverPath = join(root, 'frontend/server/infra-costs.ts');
const neonServerPath = join(root, 'frontend/server/infra-costs-neon.ts');
const vercelServerPath = join(root, 'frontend/server/infra-costs-vercel.ts');
const cronPath = join(root, 'frontend/app/api/cron/infra-costs-alert/route.ts');
const navPath = join(root, 'frontend/lib/admin/navigation.ts');
const sidebarPath = join(root, 'frontend/components/admin/SidebarNav.tsx');
const vercelConfigPath = join(root, 'frontend/vercel.json');

const pageSource = readFileSync(pagePath, 'utf8');
const viewSource = readFileSync(viewPath, 'utf8');
const formatSource = readFileSync(formatPath, 'utf8');
const serverSource = readFileSync(serverPath, 'utf8');
const neonServerSource = readFileSync(neonServerPath, 'utf8');
const vercelServerSource = readFileSync(vercelServerPath, 'utf8');
const cronSource = readFileSync(cronPath, 'utf8');
const navSource = readFileSync(navPath, 'utf8');
const sidebarSource = readFileSync(sidebarPath, 'utf8');
const vercelConfigSource = readFileSync(vercelConfigPath, 'utf8');

test('admin infra costs route stays a thin server wrapper', () => {
  assert.ok(existsSync(pagePath), 'admin infra costs page should exist');
  assert.ok(existsSync(viewPath), 'admin infra costs view should exist');
  assert.ok(existsSync(formatPath), 'admin infra costs format helper should exist');

  assert.match(pageSource, /from '\.\/_components\/AdminInfraCostsView'/, 'page should import the view');
  assert.match(pageSource, /fetchInfraCostsReport/, 'page should fetch the server report');
  assert.match(pageSource, /fetchAdminAuditLogs/, 'page should fetch recent alert audit logs');
  assert.doesNotMatch(pageSource, /AdminMetricGrid|AdminDataTable|AdminNotice/, 'admin surfaces belong in the view');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 35, `admin infra costs page should stay below 35 lines, got ${lineCount}`);
});

test('admin infra costs view owns dashboard sections and provider tables', () => {
  assert.match(viewSource, /export function AdminInfraCostsView/, 'view should be exported');
  assert.match(viewSource, /AdminPageHeader/, 'view should compose the page header');
  assert.match(viewSource, /AdminMetricGrid/, 'view should render metric grids');
  assert.match(viewSource, /function NeonDetails/, 'view should own Neon detail table');
  assert.match(viewSource, /function VercelDetails/, 'view should own Vercel detail table');
  assert.match(viewSource, /function RecentAlerts/, 'view should own alert audit table');
});

test('infra costs format helper owns display formatting', () => {
  for (const exportName of ['formatUsd', 'formatNumber', 'formatGb', 'formatDateTime', 'formatPercent', 'formatAlertLevel']) {
    assert.match(formatSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }
});

test('infra costs server module fetches Neon and Vercel data without client exposure', () => {
  assert.match(serverSource, /fetchNeonInfraCostReport/, 'server report should compose the Neon provider module');
  assert.match(serverSource, /fetchVercelInfraCostReport/, 'server report should compose the Vercel provider module');
  assert.match(neonServerSource, /consumption_history\/v2\/projects/, 'Neon provider should call consumption history');
  assert.match(vercelServerSource, /\/v1\/billing\/charges/, 'Vercel provider should call billing charges');
  assert.match(serverSource, /buildInfraCostAlertDigest/, 'server report should expose alert digest');
  assert.doesNotMatch(viewSource, /NEON_API_KEY|VERCEL_TOKEN|Authorization/, 'view must not reference provider secrets');
});

test('infra costs alert cron is authenticated and scheduled', () => {
  assert.ok(existsSync(cronPath), 'infra costs cron route should exist');
  assert.match(cronSource, /authorizeCronRequest/, 'cron should use shared Vercel cron auth');
  assert.match(cronSource, /INFRA_COST_ALERT_ACTION/, 'cron should write a typed audit action');
  assert.match(cronSource, /buildInfraCostAlertDigest/, 'cron should use the report digest');
  assert.match(vercelConfigSource, /\/api\/cron\/infra-costs-alert/, 'Vercel cron config should schedule infra costs alerts');
});

test('infra costs is reachable from admin navigation', () => {
  assert.match(navSource, /id: 'infra-costs'/, 'admin nav should include infra costs');
  assert.match(navSource, /href: '\/admin\/infra-costs'/, 'admin nav should link to infra costs');
  assert.match(sidebarSource, /costs: BadgeDollarSign/, 'sidebar should map the infra costs icon');
});
