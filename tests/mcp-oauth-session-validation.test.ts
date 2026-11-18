import assert from 'node:assert/strict';
import test from 'node:test';
import { hasActiveOAuthGrant } from '../frontend/src/server/mcp/oauth-adapter';
import { readOAuthUserInfo } from '../frontend/src/server/mcp/oauth-session-validation';

const binding = { userId: 'user-1', sessionId: 'session-1' };

test('OAuth consent validation uses a server-only lookup when delegated tokens cannot list grants', async () => {
  const requests: Request[] = [];
  const active = await hasActiveOAuthGrant(binding, 'client-1', {
    supabaseUrl: 'https://project.supabase.co',
    serviceRoleKey: 'test-server-key',
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      if (new URL(request.url).pathname === '/auth/v1/user/oauth/grants') {
        return Response.json({ code: 'no_authorization' }, { status: 403 });
      }
      return Response.json(true);
    },
  }, ['openid']);

  assert.equal(active, true);
  assert.equal(requests.length, 1);
  const request = requests[0]!;
  assert.equal(request.url, 'https://project.supabase.co/rest/v1/rpc/mcp_oauth_grant_is_active');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.get('authorization'), 'Bearer test-server-key');
  assert.equal(request.headers.get('apikey'), 'test-server-key');
  assert.equal(request.cache, 'no-store');
  assert.equal(request.redirect, 'error');
  assert.deepEqual(await request.json(), {
    p_user_id: 'user-1', p_client_id: 'client-1', p_session_id: 'session-1', p_required_scopes: ['openid'],
  });
});

test('OAuth consent validation fails closed on missing bindings or a non-boolean RPC result', async () => {
  const config = { supabaseUrl: 'https://project.supabase.co', serviceRoleKey: 'test-server-key' };
  for (const body of [false, null, {}, [], 'true', { active: true }]) {
    assert.equal(await hasActiveOAuthGrant(binding, 'client-1', {
      ...config, fetcher: async () => Response.json(body),
    }), false);
  }
  for (const status of [401, 403, 404, 500, 503]) {
    assert.equal(await hasActiveOAuthGrant(binding, 'client-1', {
      ...config, fetcher: async () => new Response(null, { status }),
    }), false);
  }
  assert.equal(await hasActiveOAuthGrant(binding, 'client-1', {
    ...config, fetcher: async () => { throw new Error('offline'); },
  }), false);
  assert.equal(await hasActiveOAuthGrant({ userId: 'user-1', sessionId: '' }, 'client-1', {
    ...config, fetcher: async () => assert.fail('Missing signed session must not reach the network.'),
  }), false);
});

test('OAuth identity uses the provider UserInfo endpoint and its authoritative verification flag', async () => {
  const requests: Request[] = [];
  const config = { supabaseUrl: 'https://project.supabase.co', anonKey: 'public-test-key' };
  const user = await readOAuthUserInfo('delegated-token', {
    ...config, fetcher: async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({ sub: 'user-1', email_verified: true, email: 'test@example.invalid' });
    },
  });
  assert.deepEqual(user, { id: 'user-1', email_verified: true });
  assert.equal(requests[0]!.url, 'https://project.supabase.co/auth/v1/oauth/userinfo');
  assert.equal(requests[0]!.headers.get('authorization'), 'Bearer delegated-token');
  assert.equal(requests[0]!.headers.get('apikey'), 'public-test-key');
  assert.equal(requests[0]!.cache, 'no-store');
  assert.equal(requests[0]!.redirect, 'error');
  for (const info of [{ sub: 'user-1', email_verified: 'true' }, { sub: 'user-1', email_verified: false, user_metadata: { email_verified: true } }]) {
    assert.deepEqual(await readOAuthUserInfo('token', { ...config, fetcher: async () => Response.json(info) }), { id: 'user-1', email_verified: false });
  }
  for (const info of [null, [], {}, { sub: '' }, { sub: 1 }]) {
    assert.equal(await readOAuthUserInfo('token', { ...config, fetcher: async () => Response.json(info) }), null);
  }
  assert.equal(await readOAuthUserInfo('token', { ...config, fetcher: async () => new Response(null, { status: 403 }) }), null);
});

test('an openid-only grant preserves authoritative verification without reading email from the delegated token', async () => {
  const requests: Request[] = [];
  const user = await readOAuthUserInfo('delegated-token', {
    supabaseUrl: 'https://project.supabase.co', anonKey: 'public-test-key', serviceRoleKey: 'test-server-key',
    fetcher: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json(new URL(request.url).pathname.endsWith('/oauth/userinfo')
        ? { sub: 'user-1' }
        : { id: 'user-1', email_confirmed_at: '2026-11-01T00:00:00Z', user_metadata: {} });
    },
  });
  assert.deepEqual(user, { id: 'user-1', email_verified: true });
  assert.equal(requests.length, 2);
  assert.equal(requests[1]!.url, 'https://project.supabase.co/auth/v1/admin/users/user-1');
  assert.equal(requests[1]!.headers.get('authorization'), 'Bearer test-server-key');
  assert.equal(requests[1]!.redirect, 'error');
  assert.equal(requests[1]!.cache, 'no-store');
});

test('scope-limited identity fallback rejects mismatched or unavailable administrative identity', async () => {
  const config = { supabaseUrl: 'https://project.supabase.co', anonKey: 'public-test-key', serviceRoleKey: 'test-server-key' };
  for (const admin of [null, [], { id: 'other-user', email_confirmed_at: '2026-11-01' }]) {
    assert.equal(await readOAuthUserInfo('token', { ...config, fetcher: async input => Response.json(
      new URL(String(input)).pathname.endsWith('/oauth/userinfo') ? { sub: 'user-1' } : admin,
    ) }), null);
  }
  assert.deepEqual(await readOAuthUserInfo('token', { ...config, fetcher: async input => Response.json(
    new URL(String(input)).pathname.endsWith('/oauth/userinfo') ? { sub: 'user-1' }
      : { id: 'user-1', email_confirmed_at: null, user_metadata: { email_verified: true } },
  ) }), { id: 'user-1', email_verified: false });
  assert.equal(await readOAuthUserInfo('token', { ...config, fetcher: async input =>
    new URL(String(input)).pathname.endsWith('/oauth/userinfo') ? Response.json({ sub: 'user-1' }) : new Response(null, { status: 503 }),
  }), null);
});
