import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const appShellPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx';
const noticeHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceNotice.ts';
const previewStateHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreviewState.ts';
const routeNavigationHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteNavigation.ts';

test('workspace shell, notice, preview composition, and route navigation are owned by route-local modules', () => {
  assert.equal(existsSync(appShellPath), true);
  assert.equal(existsSync(noticeHookPath), true);
  assert.equal(existsSync(previewStateHookPath), true);
  assert.equal(existsSync(routeNavigationHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const shellSource = readFileSync(appShellPath, 'utf8');
  const noticeHookSource = readFileSync(noticeHookPath, 'utf8');
  const previewHookSource = readFileSync(previewStateHookPath, 'utf8');
  const routeHookSource = readFileSync(routeNavigationHookPath, 'utf8');

  assert.match(appSource, /import \{ WorkspaceAppShell \} from '\.\/_components\/WorkspaceAppShell';/);
  assert.match(appSource, /import \{ useWorkspaceNotice \} from '\.\/_hooks\/useWorkspaceNotice';/);
  assert.match(appSource, /import \{ useWorkspacePreviewState \} from '\.\/_hooks\/useWorkspacePreviewState';/);
  assert.match(appSource, /import \{ useWorkspaceRouteNavigation \} from '\.\/_hooks\/useWorkspaceRouteNavigation';/);
  assert.match(appSource, /<WorkspaceAppShell/);
  assert.match(appSource, /useWorkspaceNotice\(\)/);
  assert.match(appSource, /useWorkspacePreviewState\(\{/);
  assert.match(appSource, /useWorkspaceRouteNavigation\(\{/);

  assert.doesNotMatch(appSource, /authFetch/);
  assert.doesNotMatch(appSource, /useRouter/);
  assert.doesNotMatch(appSource, /noticeTimeoutRef/);
  assert.doesNotMatch(appSource, /window\.setTimeout/);
  assert.doesNotMatch(appSource, /window\.clearTimeout/);
  assert.doesNotMatch(appSource, /mapSelectedPreviewToGroup/);
  assert.doesNotMatch(appSource, /adaptGroupSummary/);
  assert.doesNotMatch(appSource, /normalizeGroupSummary/);
  assert.doesNotMatch(appSource, /getCompositePreviewPosterSrc/);
  assert.doesNotMatch(appSource, /<WorkspaceChrome/);
  assert.doesNotMatch(appSource, /<GalleryRail/);
  assert.doesNotMatch(appSource, /<WorkspaceCenterGallery/);
  assert.doesNotMatch(appSource, /<WorkspacePreviewDock/);

  assert.match(shellSource, /WorkspaceChrome/);
  assert.match(shellSource, /GalleryRail/);
  assert.match(shellSource, /WorkspaceCenterGallery/);
  assert.match(shellSource, /WorkspacePreviewDock/);

  assert.match(noticeHookSource, /window\.setTimeout/);
  assert.match(noticeHookSource, /window\.clearTimeout/);

  assert.match(previewHookSource, /mapSelectedPreviewToGroup/);
  assert.match(previewHookSource, /adaptGroupSummary/);
  assert.match(previewHookSource, /normalizeGroupSummary/);
  assert.match(previewHookSource, /getCompositePreviewPosterSrc/);

  assert.match(routeHookSource, /authFetch/);
  assert.match(routeHookSource, /useRouter/);
  assert.match(routeHookSource, /onboarding/);
});
