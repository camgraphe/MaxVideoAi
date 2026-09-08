import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startStudioAuthFixture, STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { resolveAgentPrincipal } from '../frontend/src/server/mcp/oauth-adapter';

const requireFrontend = createRequire(resolve('frontend/package.json'));
const { createClient } = requireFrontend('@supabase/supabase-js');
const { createServerClient } = requireFrontend('@supabase/ssr');

test('disposable auth validates two signed identities through the installed SDK and rejects forged or revoked tokens', async () => {
  const fixture = await startStudioAuthFixture();
  const client = createClient(fixture.origin, fixture.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    for (const owner of STUDIO_FIXTURE_OWNERS) {
      const session = fixture.createSession(owner);
      const claims = await client.auth.getClaims(session.access_token);
      assert.equal(claims.error, null);
      assert.equal(claims.data.claims.sub, owner);
      const user = await client.auth.getUser(session.access_token);
      assert.equal(user.error, null);
      assert.equal(user.data.user.id, owner);
    }
    const session = fixture.createSession(STUDIO_FIXTURE_OWNERS[0]);
    const pieces = session.access_token.split('.');
    pieces[1] = Buffer.from(JSON.stringify({ sub: STUDIO_FIXTURE_OWNERS[1], exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
    assert.ok((await client.auth.getClaims(pieces.join('.'))).error);
    assert.equal((await client.auth.getUser(pieces.join('.'))).data.user, null);
    fixture.revokeSession(session.access_token);
    assert.equal((await client.auth.getUser(session.access_token)).data.user, null);
    assert.equal((await fetch(`${fixture.origin}/auth/v1/user`)).status, 401);
    assert.equal((await fetch(`${fixture.origin}/unimplemented`)).status, 404);
  } finally {
    await fixture.close();
  }
});

test('fixture cookies use actual SSR session encoding and expired sessions refresh without an identity stub', async () => {
  const fixture = await startStudioAuthFixture();
  try {
    const session = fixture.createSession(STUDIO_FIXTURE_OWNERS[0], { expiresIn: -60 });
    let cookies = fixture.cookiesFor(session);
    const previousCookieValues = JSON.stringify(cookies);
    const client = createServerClient(fixture.origin, fixture.anonKey, {
      cookies: {
        getAll: () => cookies,
        setAll: (next: Array<{ name: string; value: string }>) => {
          for (const item of next) cookies = [...cookies.filter((cookie) => cookie.name !== item.name), item];
        },
      },
    });
    const result = await client.auth.getSession();
    assert.equal(result.error, null);
    assert.equal(result.data.session.user.id, STUDIO_FIXTURE_OWNERS[0]);
    assert.notEqual(result.data.session.access_token, session.access_token);
    const claims = await client.auth.getClaims(result.data.session.access_token);
    assert.equal(claims.error, null);
    assert.equal(claims.data.claims.sub, STUDIO_FIXTURE_OWNERS[0]);
    assert.ok(cookies.some((cookie) => cookie.name.startsWith('sb-127-auth-token')));
    assert.notEqual(JSON.stringify(cookies), previousCookieValues);
    const reopened = createServerClient(fixture.origin, fixture.anonKey, {
      cookies: { getAll: () => cookies, setAll: () => assert.fail('A fresh valid cookie must not need another refresh.') },
    });
    const restored = await reopened.auth.getSession();
    assert.equal(restored.error, null);
    assert.equal(restored.data.session.access_token, result.data.session.access_token);
    const restoredUser = await reopened.auth.getUser();
    assert.equal(restoredUser.error, null);
    assert.equal(restoredUser.data.user.id, STUDIO_FIXTURE_OWNERS[0]);
  } finally {
    await fixture.close();
  }
});

test('real MCP principal adapter consumes SDK-verified bearer and refuses cookie-only authentication', async () => {
  const fixture = await startStudioAuthFixture();
  const client = createClient(fixture.origin, fixture.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const session = fixture.createSession(STUDIO_FIXTURE_OWNERS[0], { clientId: 'studio-fixture-client' });
    const deps = { createAuthClient: async () => client.auth };
    const principal = await resolveAgentPrincipal(new Request('http://127.0.0.1/mcp', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }), deps);
    assert.deepEqual(principal, { userId: STUDIO_FIXTURE_OWNERS[0], clientId: 'studio-fixture-client', emailVerified: true, authMethod: 'oauth' });
    await assert.rejects(resolveAgentPrincipal(new Request('http://127.0.0.1/mcp', {
      headers: { cookie: fixture.cookiesFor(session).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') },
    }), deps), /Authentication required/);
  } finally {
    await fixture.close();
  }
});
