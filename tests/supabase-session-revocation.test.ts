import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { NextRequest, NextResponse } from 'next/server';
import { startStudioAuthFixture, STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';

type Cookie = { name: string; value: string };
type CookieStore = { getAll(): Cookie[]; set(name: string, value: string): void };

test('server authorization rejects revoked signed sessions and preserves active session workflows', async (t) => {
  const fixture = await startStudioAuthFixture();
  const dir = mkdtempSync(join(tmpdir(), 'supabase-session-revocation-'));
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const state = globalThis as typeof globalThis & { __sessionRevocationCookies?: CookieStore };
  let jar: Cookie[] = [];
  state.__sessionRevocationCookies = {
    getAll: () => jar,
    set: (name, value) => { jar = [...jar.filter((cookie) => cookie.name !== name), { name, value }]; },
  };
  const output = join(dir, 'auth.cjs');
  try {
    await build({
      stdin: { contents: "export { getRouteAuthContext, updateSession } from './frontend/src/lib/supabase-ssr';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      define: {
        'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(fixture.origin),
        'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(fixture.anonKey),
      },
      plugins: [{ name: 'next-request-cookie-context', setup(builder) {
        builder.onResolve({ filter: /^@supabase\/ssr$/ }, () => ({ path: requireFrontend.resolve('@supabase/ssr'), external: true }));
        builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'headers', namespace: 'request-context' }));
        builder.onLoad({ filter: /.*/, namespace: 'request-context' }, () => ({ contents: 'export async function cookies(){return globalThis.__sessionRevocationCookies;}' }));
      } }],
    });
    const { getRouteAuthContext, updateSession } = requireFrontend(output);
    const request = (authorization?: string, owned = false) => new NextRequest('http://localhost/billing', {
      headers: { cookie: jar.map(({ name, value }) => `${name}=${value}`).join('; '), ...(authorization ? { authorization } : {}), ...(owned ? {'x-maxvideoai-auth-mode':'bearer'} : {}) },
    });
    const setSession = (session: ReturnType<typeof fixture.createSession>) => { jar = fixture.cookiesFor(session); };
    const active = fixture.createSession(STUDIO_FIXTURE_OWNERS[0]);
    const revoked = fixture.createSession(STUDIO_FIXTURE_OWNERS[1]);
    fixture.revokeSession(revoked.access_token);

    await t.test('revoked unexpired cookie cannot authorize APIs or protected pages', async () => {
      setSession(revoked);
      assert.equal((await getRouteAuthContext()).userId, null);
      setSession(revoked);
      assert.equal((await updateSession(request(), NextResponse.next())).userId, null);
    });

    await t.test('chunking and forged stored user identity cannot revive a revoked session', async () => {
      const padded = { ...revoked, user: { ...revoked.user, id: STUDIO_FIXTURE_OWNERS[0], user_metadata: { padding: 'x'.repeat(5000) } } };
      jar = fixture.cookiesFor(padded as typeof revoked);
      assert.ok(jar.length > 1);
      assert.equal((await getRouteAuthContext(request())).userId, null);
      jar = fixture.cookiesFor(padded as typeof revoked);
      assert.equal((await updateSession(request(), NextResponse.next())).userId, null);
    });

    await t.test('revoked bearer or malformed authorization cannot rescue a revoked cookie', async () => {
      for (const authorization of [`Bearer ${revoked.access_token}`, 'Bearer invalid', 'Basic invalid']) {
        setSession(revoked);
        assert.equal((await getRouteAuthContext(request(authorization))).userId, null);
      }
      jar = [];
      assert.equal((await getRouteAuthContext(request(`Bearer ${revoked.access_token}`))).userId, null);
    });

    await t.test('valid cookie and request-free server component authorization remain available', async () => {
      setSession(active);
      assert.equal((await getRouteAuthContext()).userId, STUDIO_FIXTURE_OWNERS[0]);
      assert.equal((await updateSession(request(), NextResponse.next())).userId, STUDIO_FIXTURE_OWNERS[0]);
      setSession({ ...active, user: { ...active.user, id: STUDIO_FIXTURE_OWNERS[1] } });
      assert.equal((await getRouteAuthContext(request())).userId, STUDIO_FIXTURE_OWNERS[0]);
    });

    await t.test('valid bearer keeps priority and invalid bearer may use an independently valid cookie', async () => {
      jar = [];
      assert.equal((await getRouteAuthContext(request(`Bearer ${active.access_token}`))).userId, STUDIO_FIXTURE_OWNERS[0]);
      setSession(revoked);
      assert.equal((await getRouteAuthContext(request(`Bearer ${active.access_token}`))).userId, STUDIO_FIXTURE_OWNERS[0]);
      const other = fixture.createSession(STUDIO_FIXTURE_OWNERS[1]);
      setSession(other);
      assert.equal((await getRouteAuthContext(request(`Bearer ${active.access_token}`))).userId, STUDIO_FIXTURE_OWNERS[0]);
      setSession(active);
      assert.equal((await getRouteAuthContext(request('Bearer invalid'))).userId, STUDIO_FIXTURE_OWNERS[0]);
    });

    await t.test('owned transport never falls back to a different valid cookie after bearer revocation', async () => {
      const other = fixture.createSession(STUDIO_FIXTURE_OWNERS[1]);
      for (const authorization of [undefined, 'Basic invalid', 'Bearer invalid', `Bearer ${revoked.access_token}`]) {
        setSession(active);
        assert.equal((await getRouteAuthContext(request(authorization, true))).userId, null);
      }
      setSession(other);
      const result = await getRouteAuthContext(request(`Bearer ${active.access_token}`, true));
      assert.equal(result.userId, STUDIO_FIXTURE_OWNERS[0]);
      assert.equal(result.session, null, 'the ambient cookie session must not be exposed as the bearer session');
    });

    await t.test('expired active cookies rotate before verification and remain usable', async () => {
      const expired = fixture.createSession(STUDIO_FIXTURE_OWNERS[0], { expiresIn: -60 });
      setSession(expired);
      const rotated = await getRouteAuthContext(request());
      assert.equal(rotated.userId, STUDIO_FIXTURE_OWNERS[0]);
      assert.notEqual(rotated.session.access_token, expired.access_token);
      assert.equal((await getRouteAuthContext(request())).userId, STUDIO_FIXTURE_OWNERS[0]);
      const pageSession = fixture.createSession(STUDIO_FIXTURE_OWNERS[0], { expiresIn: -60 });
      setSession(pageSession);
      const response = NextResponse.next();
      assert.equal((await updateSession(request(), response)).userId, STUDIO_FIXTURE_OWNERS[0]);
      assert.ok(response.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-127-auth-token') && cookie.value));
    });

    await t.test('revoked refresh tokens and missing sessions fail closed', async () => {
      const expired = fixture.createSession(STUDIO_FIXTURE_OWNERS[1], { expiresIn: -60 });
      fixture.revokeSession(expired.access_token);
      setSession(expired);
      assert.equal((await getRouteAuthContext(request())).userId, null);
      setSession(expired);
      const response = NextResponse.next();
      assert.equal((await updateSession(request(), response)).userId, null);
      assert.ok(response.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-127-auth-token') && cookie.value === ''));
      jar = [];
      assert.equal((await getRouteAuthContext()).userId, null);
      assert.equal((await updateSession(request(), NextResponse.next())).userId, null);
    });
  } finally {
    delete state.__sessionRevocationCookies;
    await fixture.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
