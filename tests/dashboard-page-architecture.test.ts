import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/dashboard/page.tsx');
const shellPath = join(root, 'frontend/app/(core)/dashboard/_components/DashboardPageShell.tsx');
const accountHookPath = join(root, 'frontend/app/(core)/dashboard/_hooks/useDashboardAccountSummary.ts');
const engineHookPath = join(root, 'frontend/app/(core)/dashboard/_hooks/useDashboardEngineSelection.ts');
const exportsHookPath = join(root, 'frontend/app/(core)/dashboard/_hooks/useDashboardExportsSummary.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const shellSource = readFileSync(shellPath, 'utf8');
const accountHookSource = readFileSync(accountHookPath, 'utf8');
const engineHookSource = readFileSync(engineHookPath, 'utf8');
const exportsHookSource = readFileSync(exportsHookPath, 'utf8');

test('dashboard page delegates shell and account/create selection state', () => {
  assert.ok(existsSync(pagePath), 'dashboard page should exist');
  assert.ok(existsSync(shellPath), 'dashboard shell component should exist');
  assert.ok(existsSync(accountHookPath), 'account summary hook should exist');
  assert.ok(existsSync(engineHookPath), 'engine selection hook should exist');
  assert.ok(existsSync(exportsHookPath), 'exports summary hook should exist');

  assert.match(pageSource, /from '\.\/_components\/DashboardPageShell'/, 'page should import the route shell');
  assert.match(pageSource, /from '\.\/_hooks\/useDashboardAccountSummary'/, 'page should import account hook');
  assert.match(pageSource, /from '\.\/_hooks\/useDashboardEngineSelection'/, 'page should import engine selection hook');
  assert.doesNotMatch(pageSource, /HeaderBar|AppSidebar/, 'route shell should own dashboard chrome');
  assert.doesNotMatch(pageSource, /dynamic\(/, 'route shell should own dynamic MediaLightbox import');
  assert.doesNotMatch(pageSource, /readStoredForm|readStoredImageForm/, 'engine hook should own stored create selections');
  assert.doesNotMatch(pageSource, /persistVideoSelection|persistImageSelection/, 'engine hook should own persisted create selections');
  assert.doesNotMatch(pageSource, /writeLastKnownWallet|writeLastKnownMember/, 'account hook should own last-known writes');
  assert.doesNotMatch(pageSource, /NEW_USER_ENGINE_ID/, 'engine hook should own new-user defaults');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 430, `dashboard page should stay below 430 lines after extraction, got ${lineCount}`);
});

test('dashboard shell owns chrome, panels, and lightbox composition', () => {
  assert.match(shellSource, /export function DashboardPageShell/, 'shell component should be exported');
  assert.match(shellSource, /HeaderBar/, 'shell should own header chrome');
  assert.match(shellSource, /AppSidebar/, 'shell should own sidebar chrome');
  assert.match(shellSource, /dynamic\(/, 'shell should own dynamic lightbox import');
  assert.match(shellSource, /<CreateHero/, 'shell should own create hero placement');
  assert.match(shellSource, /<RecentGrid/, 'shell should own recent grid placement');
  assert.match(shellSource, /<MediaLightbox/, 'shell should own lightbox rendering');
  assert.match(shellSource, /buildEntriesFromGroup/, 'shell should build group lightbox entries');
  assert.match(shellSource, /buildEntriesFromJob/, 'shell should build job lightbox entries');
});

test('dashboard hooks own account, exports, and engine selection responsibilities', () => {
  assert.match(accountHookSource, /export function useDashboardAccountSummary/, 'account hook should be exported');
  assert.match(accountHookSource, /\/api\/wallet/, 'account hook should fetch wallet state');
  assert.match(accountHookSource, /\/api\/member-status/, 'account hook should fetch member state');
  assert.match(accountHookSource, /writeLastKnownWallet/, 'account hook should persist last-known wallet');
  assert.match(accountHookSource, /writeLastKnownMember/, 'account hook should persist last-known member');

  assert.match(exportsHookSource, /export function useDashboardExportsSummary/, 'exports hook should be exported');
  assert.match(exportsHookSource, /\/api\/user\/exports\/summary/, 'exports hook should fetch export summary');

  assert.match(engineHookSource, /export function useDashboardEngineSelection/, 'engine selection hook should be exported');
  assert.match(engineHookSource, /readStoredForm/, 'engine hook should read stored video form');
  assert.match(engineHookSource, /readStoredImageForm/, 'engine hook should read stored image form');
  assert.match(engineHookSource, /persistVideoSelection/, 'engine hook should persist video selection');
  assert.match(engineHookSource, /persistImageSelection/, 'engine hook should persist image selection');
  assert.match(engineHookSource, /NEW_USER_ENGINE_ID/, 'engine hook should own new-user engine default');
  assert.match(engineHookSource, /supportsImageModes/, 'engine hook should filter image-capable engines');
});
