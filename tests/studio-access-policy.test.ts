import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from '../frontend/node_modules/next/server';
import {
  resolveStudioApiAccess,
  resolveStudioPageAccess,
  type StudioAccessDependencies,
  type StudioAccessPolicy,
} from '../frontend/src/server/studio/access';

const enabledAdminOnly: StudioAccessPolicy = { enabled: true, adminOnly: true };

function dependencies(overrides: Partial<StudioAccessDependencies> = {}): StudioAccessDependencies {
  return {
    resolveRequestUserId: async (request) => {
      const token = request.headers.get('authorization');
      if (token === 'Bearer admin-token') return 'admin-user';
      if (token === 'Bearer member-token') return 'member-user';
      return null;
    },
    resolvePageUserId: async () => null,
    resolveLocalBypassUserId: async () => null,
    isAdmin: async (userId) => userId === 'admin-user',
    ...overrides,
  };
}

test('Studio API access keeps bearer identity and requires an administrator during preview', async () => {
  const admin = await resolveStudioApiAccess(
    new NextRequest('http://localhost/api/studio/projects', {
      headers: { Authorization: 'Bearer admin-token' },
    }),
    enabledAdminOnly,
    dependencies(),
  );
  const member = await resolveStudioApiAccess(
    new NextRequest('http://localhost/api/studio/projects', {
      headers: { Authorization: 'Bearer member-token' },
    }),
    enabledAdminOnly,
    dependencies(),
  );
  const anonymous = await resolveStudioApiAccess(
    new NextRequest('http://localhost/api/studio/projects'),
    enabledAdminOnly,
    dependencies(),
  );

  assert.deepEqual(admin, { ok: true, userId: 'admin-user' });
  assert.deepEqual(member, { ok: false, status: 403, error: 'FORBIDDEN' });
  assert.deepEqual(anonymous, { ok: false, status: 401, error: 'UNAUTHORIZED' });
});

test('Studio access follows disabled and authenticated-member modes without an admin-only drift', async () => {
  const request = new NextRequest('http://localhost/api/studio/projects', {
    headers: { Authorization: 'Bearer member-token' },
  });
  assert.deepEqual(
    await resolveStudioApiAccess(request, { enabled: false, adminOnly: true }, dependencies()),
    { ok: false, status: 404, error: 'NOT_FOUND' },
  );
  assert.deepEqual(
    await resolveStudioApiAccess(request, { enabled: true, adminOnly: false }, dependencies()),
    { ok: true, userId: 'member-user' },
  );
});

test('Studio access fails closed when identity or role resolution fails', async () => {
  const request = new NextRequest('http://localhost/api/studio/projects', {
    headers: { Authorization: 'Bearer admin-token' },
  });
  assert.deepEqual(
    await resolveStudioApiAccess(request, enabledAdminOnly, dependencies({
      resolveRequestUserId: async () => { throw new Error('auth unavailable'); },
    })),
    { ok: false, status: 500, error: 'ACCESS_CHECK_FAILED' },
  );
  assert.deepEqual(
    await resolveStudioApiAccess(request, enabledAdminOnly, dependencies({
      isAdmin: async () => { throw new Error('role unavailable'); },
    })),
    { ok: false, status: 500, error: 'ACCESS_CHECK_FAILED' },
  );
});

test('Studio page access accepts only a verified local bypass when no cookie session exists', async () => {
  assert.deepEqual(
    await resolveStudioPageAccess(enabledAdminOnly, dependencies({
      resolveLocalBypassUserId: async () => 'local-admin',
    })),
    { ok: true, userId: 'local-admin' },
  );
  assert.deepEqual(
    await resolveStudioPageAccess(enabledAdminOnly, dependencies()),
    { ok: false, status: 401, error: 'UNAUTHORIZED' },
  );
});
