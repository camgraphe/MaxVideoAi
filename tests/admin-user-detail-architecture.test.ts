import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routeRoot = join(root, 'frontend/app/(core)/admin/users/[userId]');
const pagePath = join(routeRoot, 'page.tsx');
const viewPath = join(routeRoot, '_components/AdminUserDetailView.tsx');
const identitySectionPath = join(routeRoot, '_components/AdminUserIdentitySection.tsx');
const usageSectionPath = join(routeRoot, '_components/AdminUserUsageSection.tsx');
const walletSectionPath = join(routeRoot, '_components/AdminUserWalletLedgerSection.tsx');
const supportSectionPath = join(routeRoot, '_components/AdminUserSupportActionsSection.tsx');
const formatPath = join(routeRoot, '_lib/admin-user-detail-format.ts');
const metricsPath = join(routeRoot, '_lib/admin-user-detail-metrics.ts');
const typesPath = join(routeRoot, '_lib/admin-user-detail-types.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const viewSource = readFileSync(viewPath, 'utf8');
const identitySectionSource = readFileSync(identitySectionPath, 'utf8');
const usageSectionSource = readFileSync(usageSectionPath, 'utf8');
const walletSectionSource = readFileSync(walletSectionPath, 'utf8');
const supportSectionSource = readFileSync(supportSectionPath, 'utf8');
const formatSource = readFileSync(formatPath, 'utf8');
const metricsSource = readFileSync(metricsPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('admin user detail page stays a thin server route wrapper', () => {
  for (const file of [
    pagePath,
    viewPath,
    identitySectionPath,
    usageSectionPath,
    walletSectionPath,
    supportSectionPath,
    formatPath,
    metricsPath,
    typesPath,
  ]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }

  assert.match(pageSource, /fetchAdminUserOverview/, 'page should own server data fetch orchestration');
  assert.match(pageSource, /from '\.\/_components\/AdminUserDetailView'/, 'page should import detail view');
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/, 'page should stay dynamic');
  assert.match(pageSource, /export const runtime = 'nodejs'/, 'page should keep node runtime');
  assert.match(pageSource, /notFound\(\)/, 'page should guard missing user id');

  for (const forbidden of [
    'AdminDataTable',
    'ManualCreditForm',
    'function MetadataPanel',
    'function JobStatusBadge',
    'function buildMemberPulseItems',
    'new Intl.',
    'process.env.DATABASE_URL',
  ]) {
    assert.doesNotMatch(pageSource, new RegExp(forbidden.replaceAll('.', '\\.')), `${forbidden} should not live in the page wrapper`);
  }

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 30, `admin user detail page should stay below 30 lines, got ${lineCount}`);
});

test('admin user detail view composes route sections', () => {
  assert.match(viewSource, /export function AdminUserDetailView/, 'detail view should be exported');
  assert.match(viewSource, /AdminPageHeader/, 'detail view should own header composition');
  assert.match(viewSource, /AdminUserIdentitySection/, 'detail view should compose identity section');
  assert.match(viewSource, /AdminUserUsageSection/, 'detail view should compose usage section');
  assert.match(viewSource, /AdminUserWalletLedgerSection/, 'detail view should compose wallet section');
  assert.match(viewSource, /AdminUserSupportActionsSection/, 'detail view should compose support actions');
  assert.match(viewSource, /buildMemberPulseItems/, 'detail view should use metric builder');
  assert.doesNotMatch(viewSource, /AdminDataTable/, 'table rendering belongs in sections');
  assert.doesNotMatch(viewSource, /ManualCreditForm/, 'support action controls belong in support section');
});

test('admin user detail sections own focused UI responsibilities', () => {
  assert.match(identitySectionSource, /export function AdminUserIdentitySection/, 'identity section should be exported');
  assert.match(identitySectionSource, /function ProfileField/, 'identity section should own profile fields');
  assert.match(identitySectionSource, /function MetadataPanel/, 'identity section should own metadata panel');

  assert.match(usageSectionSource, /export function AdminUserUsageSection/, 'usage section should be exported');
  assert.match(usageSectionSource, /function RecentJobsTable/, 'usage section should own recent jobs table');
  assert.match(usageSectionSource, /function EngineMixPanel/, 'usage section should own engine mix');
  assert.match(usageSectionSource, /function JobStatusBadge/, 'usage section should own local job badge mapping');

  assert.match(walletSectionSource, /export function AdminUserWalletLedgerSection/, 'wallet ledger section should be exported');
  assert.match(walletSectionSource, /AdminDataTable/, 'wallet section should own ledger table rendering');

  assert.match(supportSectionSource, /export function AdminUserSupportActionsSection/, 'support section should be exported');
  assert.match(supportSectionSource, /AdminInspectorPanel/, 'support section should use sticky admin inspector shell');
  assert.match(supportSectionSource, /ManualCreditForm/, 'support section should own manual credit form wiring');
  assert.match(supportSectionSource, /function ImpersonationPanel/, 'support section should own impersonation form');
});

test('admin user detail helpers expose formatting, metrics, and server DTO types', () => {
  for (const exportName of ['formatNumber', 'formatCurrency', 'formatDateTime', 'formatShortDate', 'truncateId']) {
    assert.match(formatSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(metricsSource, /export function buildMemberPulseItems/, 'metric builder should be exported');
  assert.match(metricsSource, /AdminMetricItem/, 'metric builder should return admin-system metric items');

  for (const typeName of [
    'AdminUserOverview',
    'AdminUserProfile',
    'AdminUserTopup',
    'AdminUserUsage',
    'AdminUserWallet',
    'AdminUserDetailViewProps',
  ]) {
    assert.match(typesSource, new RegExp(typeName), `${typeName} should be exposed through detail types`);
  }
});
