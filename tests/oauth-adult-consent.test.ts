import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('OAuth approval records 18+ for the verified user before issuing a grant, while refusal stays available', async t => {
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const dir = mkdtempSync(join(tmpdir(), 'oauth-adult-'));
  const state = { userId: 'verified-user' as string | null, unavailable: false, calls: [] as string[], entries: [] as unknown[] };
  const globals = globalThis as typeof globalThis & { __oauthAdult?: typeof state };
  globals.__oauthAdult = state;
  t.after(() => { delete globals.__oauthAdult; rmSync(dir, { recursive: true, force: true }); });
  const outfile = join(dir, 'route.cjs');
  await build({ entryPoints: ['frontend/app/api/oauth/decision/route.ts'], outfile, bundle: true, platform: 'node',
    format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'identity-and-grant-boundaries', setup(b) {
      const mocks: Record<string, string> = {
        '@/lib/supabase-ssr': `export const createSupabaseRouteClient=async()=>({auth:{
          getClaims:async()=>({data:{claims:{sub:globalThis.__oauthAdult.userId}}}),
          getUser:async()=>({data:{user:{id:globalThis.__oauthAdult.userId}}}),
          oauth:{getAuthorizationDetails:async()=>({data:{authorization_id:'authz_1234567890',client:{id:'test-client'}}}),
            approveAuthorization:async()=>{globalThis.__oauthAdult.calls.push('approve');return {data:{redirect_url:'https://client.example/callback?code=synthetic'}}},
            denyAuthorization:async()=>{globalThis.__oauthAdult.calls.push('deny');return {data:{redirect_url:'https://client.example/callback?error=access_denied'}}}}
        }});`,
        '@/server/mcp/feature-access': 'export const isMcpFoundationFeatureEnabled=()=>true;',
        '@/server/agent-api/mcp-funnel': 'export const approveMcpOAuthConnectionBinding=async()=>{};',
        '@/server/legal-consents': `export const recordUserConsents=async input=>{const s=globalThis.__oauthAdult;if(s.unavailable)throw new Error('unavailable');s.calls.push('consent');s.entries.push(input);};`,
      };
      b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'mock' }
        : a.path === 'next/server' ? { path: requireFrontend.resolve(a.path), external: true } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: mocks[a.path], loader: 'ts' }));
    } }] });
  const { POST } = requireFrontend(outfile) as { POST(request: Request): Promise<Response> };
  const request = (decision: string, age?: string) => {
    const body = new URLSearchParams({ decision, authorization_id: 'authz_1234567890', user_id: 'forged' });
    if (age !== undefined) body.set('age_confirmed', age);
    return new Request('https://maxvideoai.com/api/oauth/decision', { method: 'POST', headers: { origin: 'https://maxvideoai.com', host: 'maxvideoai.com' }, body });
  };
  assert.equal((await POST(request('approve'))).status, 422);
  assert.deepEqual(state.calls, []);
  assert.equal((await POST(request('deny'))).status, 303);
  assert.deepEqual(state.calls, ['deny']);
  state.calls.length = 0;
  state.unavailable = true;
  assert.equal((await POST(request('approve', 'true'))).status, 503);
  assert.deepEqual(state.calls, [], 'failed recording must not issue a grant');
  state.unavailable = false;
  assert.equal((await POST(request('approve', 'true'))).status, 303);
  assert.deepEqual(state.calls, ['consent', 'approve']);
  assert.deepEqual(state.entries[0], {
    userId: 'verified-user', entries: [{ docKey: 'age_attestation', docVersion: 'min_age:18', accepted: true, source: 'oauth' }],
    defaultSource: 'reconsent', userAgent: null, ip: null,
  });
  state.userId = null;
  assert.equal((await POST(request('approve', 'true'))).status, 401);
  assert.equal(state.entries.length, 1);
});
