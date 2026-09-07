import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isAppExperiencePath } from '../frontend/lib/app-experience-path';

test('application presentation and quick navigation share a route boundary', () => {
  for (const path of ['/app', '/app/image', '/app/library', '/dashboard', '/settings', '/settings/privacy', '/jobs', '/billing', '/account/connections']) {
    assert.equal(isAppExperiencePath(path), true, path);
  }
  for (const path of [undefined, null, '/', '/fr', '/login', '/admin', '/mcp/reference-upload/private-token', '/application', '/settings-other']) {
    assert.equal(isAppExperiencePath(path), false, String(path));
  }
  const root = readFileSync('frontend/components/AppExperienceRoot.tsx', 'utf8');
  const header = readFileSync('frontend/components/HeaderBar.tsx', 'utf8');
  assert.match(root, /isAppExperiencePath\(pathname\)/);
  assert.match(header, /isAppExperiencePath\(pathname\) \? <WorkspaceMobileNav/);
  assert.match(header, /app-topbar-menu[^\n]*inline-flex xl:hidden/, 'routes without quick navigation retain their menu button');
});
