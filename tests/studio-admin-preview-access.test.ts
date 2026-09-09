import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === 'route.ts' ? [path] : [];
  });
}

test('Studio beta is discoverable while projects, workspaces, and APIs remain admin-only', () => {
  const flags = read('frontend/content/feature-flags.ts');
  const navigation = read('frontend/components/app/app-navigation.ts');
  const sidebar = read('frontend/components/AppSidebar.tsx');
  const header = read('frontend/components/HeaderBar.tsx');
  const siteMenu = read('frontend/components/app/AppSiteMenu.client.tsx');
  const visitorAccess = read('frontend/lib/visitor-access.ts');
  const middleware = read('frontend/middleware.ts');

  assert.match(flags, /studio:\s*\{[\s\S]*maxVideoAiEditor:\s*true,[\s\S]*adminOnly:\s*true/);
  assert.match(navigation, /canShowStudioNavigation\(\)/);
  assert.match(navigation, /return FEATURES\.studio\.maxVideoAiEditor/);
  assert.doesNotMatch(sidebar, /useAdminNavigationAccess/, 'public beta discovery should not require an admin lookup');
  assert.match(sidebar, /studioVisible=\{canShowStudioNavigation\(\)\}/);
  assert.match(header, /WorkspaceMobileNav studioVisible=\{canShowStudioNavigation\(\)\}/);
  assert.match(siteMenu, /getAppMenuItems\(undefined, studioVisible \?\? canShowStudioNavigation\(\)\)/);
  assert.doesNotMatch(visitorAccess, /normalized\.startsWith\('\/app\/studio/);
  assert.match(middleware, /canUseLocalAdminBypassForProtectedPath\(req, pathname, FEATURES\.studio\.adminOnly\)/);

  const projectsPage = read('frontend/app/(core)/(workspace)/app/studio/projects/page.tsx');
  assert.match(projectsPage, /resolveStudioPageAccess\(\)/);
  assert.match(projectsPage, /StudioPreviewAccess/);
  assert.match(projectsPage, /access\.ok/);
  assert.match(projectsPage, /query\.preview === 'studio-beta'/, 'admins should be able to review the gated surface without changing access');

  for (const path of [
    'frontend/app/(core)/(workspace)/app/studio/workspace/page.tsx',
    'frontend/app/(core)/(workspace)/app/studio/workspace/[projectId]/page.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /FEATURES\.studio\.adminOnly/);
    assert.match(source, /await requireAdmin\(\)/);
    assert.match(source, /notFound\(\)/);
  }

  const access = read('frontend/src/server/studio/access.ts');
  assert.match(access, /getRouteAuthContext\(request\)/);
  assert.match(access, /isAdmin:\s*isUserAdmin/);
  assert.match(access, /resolveLocalBypassUserId:\s*resolveLocalAdminBypassUserId/);

  const routeAccess = read('frontend/app/api/studio/_lib/studio-route-utils.ts');
  assert.match(routeAccess, /resolveStudioApiAccess\(req\)/);
  assert.match(routeAccess, /error: access\.error/);

  const specialRoutes = new Set([
    'frontend/app/api/studio/chat/route.ts',
    'frontend/app/api/studio/marketing-entry/route.ts',
  ]);
  const routes = routeFiles('frontend/app/api/studio');
  assert.ok(routes.length >= 13, 'every current and future Studio route should be included by discovery');
  for (const path of routes.filter((candidate) => !specialRoutes.has(candidate))) {
    assert.match(read(path), /resolveStudioRouteContext\(req\)/);
  }
  assert.match(read('frontend/app/api/studio/_lib/studio-chat-handler.ts'), /resolveStudioApiAccess/);
  assert.match(read('frontend/app/api/studio/marketing-entry/route.ts'), /handleStudioMarketingEntry/);
  assert.match(read('frontend/app/api/studio/marketing-entry/_lib/handle-studio-marketing-entry.ts'), /resolveStudioApiAccess/);
});
