import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { build } from 'esbuild';
import { NextRequest, NextResponse } from 'next/server';
import { middlewareAuthUnavailableResponse } from '../frontend/lib/middleware/routing-response';

test('middleware auth composes cancellation in the bundled Edge runtime', async () => {
  const require = createRequire(resolve('frontend/package.json'));
  const { EdgeRuntime } = require('next/dist/compiled/edge-runtime');
  const runtime = new EdgeRuntime();
  const bundle = await build({ stdin: { contents: "export { createSupabaseMiddlewareClient } from './frontend/src/lib/supabase-ssr';", resolveDir: process.cwd() },
    write: false, bundle: true, platform: 'browser', format: 'iife', globalName: 'sessionModule', tsconfig: 'frontend/tsconfig.json',
    define: { 'process.env': JSON.stringify({ NEXT_PUBLIC_SUPABASE_URL: 'https://auth.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon' }) },
    plugins: [{ name: 'edge-auth-boundary', setup(builder) {
      builder.onResolve({ filter: /^@supabase\/ssr$/ }, () => ({ path: 'ssr', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function createServerClient(url,key,options){globalThis.authOptions=options;return {};}' }));
      builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'headers', namespace: 'fixture-headers' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture-headers' }, () => ({ contents: 'export function cookies(){throw new Error("middleware must use request cookies");}' }));
    } }],
  });
  runtime.evaluate(bundle.outputFiles[0].text);
  assert.equal(await runtime.evaluate(`(async () => {
    const deadline = new AbortController();
    const caller = new AbortController();
    const request = {cookies: {getAll: () => []}};
    const response = {cookies: {set: () => {}}};
    sessionModule.createSupabaseMiddlewareClient(request, response, deadline.signal);
    let received;
    globalThis.fetch = async (input, init) => { received = init.signal; return new Response('ok'); };
    await authOptions.global.fetch(new Request('https://auth.invalid', {signal: caller.signal}));
    caller.abort();
    if (!received.aborted) return false;
    await authOptions.global.fetch('https://auth.invalid');
    deadline.abort();
    if (!received.aborted) return false;
    try { await authOptions.global.fetch('https://auth.invalid'); return false; } catch { return true; }
  })()`), true);
});

test('auth unavailability gives a translated private response while preserving session cookies', async () => {
  for (const [locale, expected] of [['en', /session has been preserved/], ['fr', /session est conservée/], ['es', /sesión se ha conservado/]] as const) {
    const request = new NextRequest('https://maxvideoai.com/app', { headers: { cookie: `mvid_locale=${locale}; sb-test-auth-token=preserved` } });
    const response = middlewareAuthUnavailableResponse(request);
    assert.equal(response.status, 503);
    assert.match(await response.text(), expected);
    assert.match(response.headers.get('cache-control') ?? '', /private.*no-store/);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(request.cookies.get('sb-test-auth-token')?.value, 'preserved');
  }
});

test('middleware auth bounds session and claims stalls, retains a completed refresh and ignores late cookies', { timeout: 22_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'middleware-auth-deadline-'));
  const fixture: { options?: any; refresh?: boolean } = {};
  const state = globalThis as typeof globalThis & { __middlewareAuthDeadline?: typeof fixture };
  state.__middlewareAuthDeadline = fixture;
  const original = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://auth.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
  try {
    const output = join(dir, 'session.cjs');
    await build({ stdin: { contents: "export { updateSession } from './frontend/src/lib/supabase-ssr';", resolveDir: process.cwd() },
      outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
      plugins: [{ name: 'stalled-auth-boundary', setup(builder) {
        builder.onResolve({ filter: /^@supabase\/ssr$/ }, () => ({ path: 'ssr', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents:
          "export function createServerClient(url,key,options){const state=globalThis.__middlewareAuthDeadline;state.options=options;return {auth:{getSession:()=>{if(!state.refresh)return new Promise(()=>{});options.cookies.setAll([{name:'sb-test-auth-token',value:'rotated',options:{httpOnly:true,path:'/'}}]);return Promise.resolve({data:{session:{access_token:'verified-by-auth-next'}},error:null});},getClaims:()=>{if(!state.refresh)throw new Error('unverified claims must not be used');return new Promise(()=>{});}}};}" }));
        builder.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'next-headers', namespace: 'headers' }));
        builder.onLoad({ filter: /.*/, namespace: 'headers' }, () => ({ contents: 'export async function cookies(){throw new Error("middleware must use request cookies");}' }));
      } }],
    });
    const require = createRequire(resolve('frontend/package.json'));
    const { updateSession } = require(output);
    const request = new NextRequest('https://maxvideoai.com/billing', { headers: { cookie: 'sb-test-auth-token=preserved' } });
    for (const refresh of [false, true]) {
    fixture.refresh = refresh;
    const response = NextResponse.next();
    let timer: ReturnType<typeof setTimeout>;
    try {
      await assert.rejects(Promise.race([
        updateSession(request, response),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('auth exceeded its response deadline')), 9000); }),
      ]), (error: any) => error?.name === 'MiddlewareAuthTimeoutError');
    } finally { clearTimeout(timer!); }
    fixture.options.cookies.setAll([{ name: 'sb-test-auth-token', value: '', options: { maxAge: 0 } }]);
    assert.equal(response.cookies.get('sb-test-auth-token')?.value, refresh ? 'rotated' : undefined);
    const unavailable = middlewareAuthUnavailableResponse(request, response);
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.cookies.get('sb-test-auth-token')?.value, refresh ? 'rotated' : undefined);
    assert.equal(request.cookies.get('sb-test-auth-token')?.value, 'preserved');
    }
  } finally {
    delete state.__middlewareAuthDeadline;
    if (original.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = original.url;
    if (original.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = original.key;
    rmSync(dir, { recursive: true, force: true });
  }
});
