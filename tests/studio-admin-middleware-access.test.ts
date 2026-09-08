import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from '../frontend/node_modules/next/server';
import { canUseLocalAdminBypassForProtectedPath } from '../frontend/lib/middleware/routing-response';

function request(host = '127.0.0.1:3046') {
  return new NextRequest(`http://${host}/app/studio/projects`, {
    headers: { host, cookie: 'mva_local_admin_bypass=1' },
  });
}

function withEnvironment(
  values: { NODE_ENV?: string; VERCEL?: string; LOCAL_ADMIN_BYPASS?: string },
  run: () => void,
) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    LOCAL_ADMIN_BYPASS: process.env.LOCAL_ADMIN_BYPASS,
  };
  Object.assign(process.env, values);
  try { run(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('local admin bypass reaches only admin and admin-preview Studio paths on loopback', () => {
  withEnvironment({ NODE_ENV: 'development', VERCEL: '', LOCAL_ADMIN_BYPASS: '1' }, () => {
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/admin/users', true), true);
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/app/studio/projects', true), true);
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/app/studio/workspace/project-1', true), true);
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/app/library', true), false);
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/app/studio/projects', false), false);
    assert.equal(canUseLocalAdminBypassForProtectedPath(request('example.com'), '/app/studio/projects', true), false);
  });
});

test('local admin bypass is impossible in production and Vercel environments', () => {
  withEnvironment({ NODE_ENV: 'production', VERCEL: '', LOCAL_ADMIN_BYPASS: '1' }, () => {
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/app/studio/projects', true), false);
  });
  withEnvironment({ NODE_ENV: 'development', VERCEL: '1', LOCAL_ADMIN_BYPASS: '1' }, () => {
    assert.equal(canUseLocalAdminBypassForProtectedPath(request(), '/admin', true), false);
  });
});
