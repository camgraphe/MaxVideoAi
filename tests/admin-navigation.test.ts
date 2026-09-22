import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_NAV_GROUPS, ADMIN_EXTERNAL_LINKS, findAdminNavMatch } from '../frontend/lib/admin/navigation';
test('five operator work areas, secondary settings and no obsolete site map', () => {
  assert.deepEqual(
    ADMIN_NAV_GROUPS.filter((group) => !group.secondary).map((group) => group.label),
    ['Overview', 'Users', 'Transactions', 'Generations', 'Content']
  );
  const paths = ADMIN_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
  for (const retired of ['/admin/theme', '/admin/pricing', '/admin/membership', '/admin/seo/cockpit'])
    assert.ok(!paths.includes(retired));
  assert.equal(
    paths.every((path) => path.startsWith('/admin')),
    true
  );
  assert.equal(ADMIN_EXTERNAL_LINKS.filter((item) => item.href === '/').length, 1);
});
test('detail routes resolve to their work area without false prefix matches', () => {
  assert.equal(findAdminNavMatch('/admin/users/person', ADMIN_NAV_GROUPS)?.group.id, 'users');
  assert.equal(findAdminNavMatch('/admin/editorial/article', ADMIN_NAV_GROUPS)?.group.id, 'content');
  assert.equal(findAdminNavMatch('/admin/mcp', ADMIN_NAV_GROUPS)?.group.id, 'overview');
  assert.equal(findAdminNavMatch('/admin/userstuff', ADMIN_NAV_GROUPS), null);
});
