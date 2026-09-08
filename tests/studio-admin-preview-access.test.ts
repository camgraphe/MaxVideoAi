import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('Studio preview is admin-only across navigation, pages, APIs, and visitor access', () => {
  const flags = read('frontend/content/feature-flags.ts');
  const navigation = read('frontend/components/app/app-navigation.ts');
  const sidebar = read('frontend/components/AppSidebar.tsx');
  const header = read('frontend/components/HeaderBar.tsx');
  const siteMenu = read('frontend/components/app/AppSiteMenu.client.tsx');
  const visitorAccess = read('frontend/lib/visitor-access.ts');

  assert.match(flags, /studio:\s*\{[\s\S]*maxVideoAiEditor:\s*true,[\s\S]*adminOnly:\s*true/);
  assert.match(navigation, /canShowStudioNavigation\(isAdmin:\s*boolean\)/);
  assert.match(sidebar, /useAdminNavigationAccess/);
  assert.match(header, /WorkspaceMobileNav studioVisible=\{canShowStudioNavigation\(isAdmin\)\}/);
  assert.match(siteMenu, /getAppMenuItems\(undefined, canShowStudioNavigation\(isAdmin\)\)/);
  assert.doesNotMatch(visitorAccess, /normalized\.startsWith\('\/app\/studio/);

  for (const path of [
    'frontend/app/(core)/(workspace)/app/studio/projects/page.tsx',
    'frontend/app/(core)/(workspace)/app/studio/workspace/page.tsx',
    'frontend/app/(core)/(workspace)/app/studio/workspace/[projectId]/page.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /FEATURES\.studio\.adminOnly/);
    assert.match(source, /await requireAdmin\(\)/);
    assert.match(source, /notFound\(\)/);
  }

  const routeAccess = read('frontend/app/api/studio/_lib/studio-route-utils.ts');
  assert.match(routeAccess, /FEATURES\.studio\.adminOnly/);
  assert.match(routeAccess, /userId = await requireAdmin\(req\)/);
  assert.match(routeAccess, /error: code/);

  for (const path of [
    'frontend/app/api/studio/timeline-exports/route.ts',
    'frontend/app/api/studio/timeline-exports/estimate/route.ts',
    'frontend/app/api/studio/timeline-exports/[exportId]/route.ts',
  ]) {
    assert.match(read(path), /resolveStudioRouteContext\(req\)/);
  }
  assert.match(read('frontend/app/api/studio/_lib/studio-chat-handler.ts'), /requireAdmin\(request\)/);
  assert.match(read('frontend/app/api/studio/marketing-entry/route.ts'), /await requireAdmin\(request\)/);
});
