import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/users/page.tsx');
const viewPath = join(root, 'frontend/app/(core)/admin/users/_components/AdminUsersView.tsx');
const hookPath = join(root, 'frontend/app/(core)/admin/users/_hooks/useAdminUsersController.ts');
const dataPath = join(root, 'frontend/app/(core)/admin/users/_lib/admin-users-data.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const viewSource = readFileSync(viewPath, 'utf8');
const hookSource = readFileSync(hookPath, 'utf8');
const dataSource = readFileSync(dataPath, 'utf8');

test('admin users page stays a thin client route wrapper', () => {
  assert.ok(existsSync(pagePath), 'admin users page should exist');
  assert.ok(existsSync(viewPath), 'admin users view should exist');
  assert.ok(existsSync(hookPath), 'admin users controller hook should exist');
  assert.ok(existsSync(dataPath), 'admin users data helper should exist');

  assert.match(pageSource, /from '\.\/_components\/AdminUsersView'/, 'page should import the view');
  assert.match(pageSource, /from '\.\/_hooks\/useAdminUsersController'/, 'page should import the controller hook');
  assert.match(pageSource, /export default function AdminUsersPage/, 'page should keep route export');
  assert.doesNotMatch(pageSource, /useSWR/, 'data fetching belongs in the controller hook');
  assert.doesNotMatch(pageSource, /useSearchParams/, 'URL state belongs in the controller hook');
  assert.doesNotMatch(pageSource, /AdminDataTable/, 'table rendering belongs in the view');
  assert.doesNotMatch(pageSource, /SUPABASE_SERVICE_ROLE_KEY/, 'notice copy belongs in the view');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 30, `admin users page should stay below 30 lines, got ${lineCount}`);
});

test('admin users controller owns URL and SWR orchestration', () => {
  assert.match(hookSource, /export function useAdminUsersController/, 'controller hook should be exported');
  assert.match(hookSource, /useSearchParams/, 'controller should own search params');
  assert.match(hookSource, /useSWR<UsersResponse>/, 'controller should fetch users');
  assert.match(hookSource, /useSWR<UserStatsResponse>/, 'controller should fetch user stats');
  assert.match(hookSource, /router\.replace/, 'controller should own URL replacement');
  assert.match(hookSource, /window\.setTimeout/, 'controller should own search debounce');
});

test('admin users view owns dashboard sections and table surfaces', () => {
  assert.match(viewSource, /export function AdminUsersView/, 'view should be exported');
  assert.match(viewSource, /AdminPageHeader/, 'view should own page header composition');
  assert.match(viewSource, /function DirectoryToolbar/, 'view should own search toolbar');
  assert.match(viewSource, /function UsersMetricSkeleton/, 'view should own metric skeleton');
  assert.match(viewSource, /function UsersTableSkeleton/, 'view should own table skeleton');
  assert.match(viewSource, /function UsersTable/, 'view should own user table');
  assert.match(viewSource, /function DirectoryPagination/, 'view should own pagination');
  assert.match(viewSource, /function InlineBadge/, 'view should own compact table badges');
});

test('admin users data helper exposes typed utilities', () => {
  for (const typeName of ['AdminUser', 'UsersResponse', 'UserStatsResponse']) {
    assert.match(dataSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'buildDirectorySummary',
    'buildUserVolumeItems',
    'normalizePositiveNumber',
    'resolveProvider',
    'formatNumber',
    'formatDateTime',
  ]) {
    assert.match(dataSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(dataSource, /export const fetchJson/, 'fetchJson should be exported');
});
