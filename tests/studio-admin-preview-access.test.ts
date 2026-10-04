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

test('Studio beta is discoverable while projects, workspaces, and APIs retain shared account access', () => {
  const navigation = read('frontend/components/app/app-navigation.ts');
  const sidebar = read('frontend/components/AppSidebar.tsx');
  const header = read('frontend/components/HeaderBar.tsx');
  const siteMenu = read('frontend/components/app/AppSiteMenu.client.tsx');
  const visitorAccess = read('frontend/lib/visitor-access.ts');
  const middleware = read('frontend/middleware.ts');

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
    assert.match(source, /resolveStudioPageAccess/);
    assert.match(source, /if \(!access.ok\) notFound\(\)/);
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
    'frontend/app/api/studio/assistance/route.ts',
    'frontend/app/api/studio/marketing-entry/route.ts',
    'frontend/app/api/studio/projects/[projectId]/image-conversation/route.ts',
    'frontend/app/api/studio/projects/[projectId]/image-conversation/confirm/route.ts',
    'frontend/app/api/studio/conversation-projects/route.ts',
    'frontend/app/api/studio/projects/[projectId]/conversation-timeline/route.ts',
    'frontend/app/api/studio/projects/[projectId]/reference-previews/route.ts',
  ]);
  const routes = routeFiles('frontend/app/api/studio');
  assert.ok(routes.length >= 13, 'every current and future Studio route should be included by discovery');
  for (const path of routes.filter((candidate) => !specialRoutes.has(candidate))) {
    assert.match(read(path), /resolveStudioRouteContext\(req\)/);
  }
  const assistanceHandler = read('frontend/app/api/studio/_lib/studio-assistance-handler.ts');
  assert.match(assistanceHandler,/resolveStudioApiAccess/);
  assert.match(assistanceHandler,/if\(!access.ok\)/);
  assert.match(read('frontend/app/api/studio/assistance/route.ts'),/handleStudioAssistance/);
  const projectListHandler=read('frontend/app/api/studio/_lib/studio-conversation-projects-handler.ts');
  assert.match(projectListHandler,/resolveStudioApiAccess/);
  assert.match(projectListHandler,/if\(!access.ok\)/);
  assert.match(read('frontend/app/api/studio/conversation-projects/route.ts'),/handleStudioConversationProjects/);
  const imageHandler = read('frontend/app/api/studio/_lib/studio-image-conversation-handler.ts');
  assert.match(imageHandler, /resolveStudioApiAccess/);
  assert.match(imageHandler, /if \(!access.ok\)/);
  assert.match(read('frontend/app/api/studio/projects/[projectId]/image-conversation/route.ts'), /handleStudioImageConversation/);
  assert.match(read('frontend/app/api/studio/projects/[projectId]/image-conversation/confirm/route.ts'), /handleStudioImageConversation/);
  const editingHandler = read('frontend/app/api/studio/_lib/studio-conversation-editing-handler.ts');
  assert.match(editingHandler,/resolveStudioApiAccess/);
  assert.match(editingHandler,/if \(!access.ok\)/);
  assert.match(editingHandler,/studioConversationEditingEnabled/);
  for (const path of ['frontend/app/api/studio/conversation-projects/route.ts','frontend/app/api/studio/projects/[projectId]/conversation-timeline/route.ts']) assert.match(read(path),/handleStudioConversationEditing/);
  const referencePreviewsHandler = read('frontend/app/api/studio/_lib/studio-reference-previews-handler.ts');
  assert.match(referencePreviewsHandler,/resolveStudioApiAccess/);
  assert.match(referencePreviewsHandler,/if \(!access.ok\)/);
  assert.match(referencePreviewsHandler,/STUDIO_IMAGE_CONVERSATION_ENABLED/);
  assert.match(read('frontend/app/api/studio/projects/[projectId]/reference-previews/route.ts'),/handleStudioReferencePreviews/);
  assert.match(read('frontend/app/api/studio/_lib/studio-chat-handler.ts'), /resolveStudioApiAccess/);
  assert.match(read('frontend/app/api/studio/marketing-entry/route.ts'), /handleStudioMarketingEntry/);
  assert.match(read('frontend/app/api/studio/marketing-entry/_lib/handle-studio-marketing-entry.ts'), /resolveStudioApiAccess/);
});
