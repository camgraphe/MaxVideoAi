import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import dns from 'node:dns/promises';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { NextRequest } from 'next/server';

type Reply = { status?: number; headers?: Record<string, string>; chunks?: string[]; body?: () => AsyncIterable<Uint8Array> };
async function fixture(t: TestContext, addresses = [{ address: '8.8.8.8', family: 4 }], replies: Reply[] = [{}]) {
  const directory = await mkdtemp(join(tmpdir(), 'download-route-'));
  const require = createRequire(resolve('frontend/package.json'));
  const output = join(directory, 'route.cjs');
  let user: string | null = 'fixture-account';
  (globalThis as any).__downloadAuth = () => ({ userId: user });
  t.after(async () => { delete (globalThis as any).__downloadAuth; await rm(directory, { recursive: true, force: true }); });
  await build({ entryPoints: ['frontend/app/api/download/route.ts'], outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'identity-boundary', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/supabase-ssr$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const getRouteAuthContext=async()=>globalThis.__downloadAuth();', loader: 'js' }));
    builder.onResolve({ filter: /^next\/server$/ }, args => ({ path: require.resolve(args.path), external: true }));
  } }] });
  const calls: { url: string; options?: https.RequestOptions }[] = [];
  const responses: Readable[] = [];
  const lookups: string[] = [];
  t.mock.method(dns, 'lookup', async (hostname: string) => { lookups.push(hostname); return hostname === 'private.example' ? [{ address: '127.0.0.1', family: 4 }] : addresses; });
  // Characterizes the old unguarded route without making any network call.
  t.mock.method(globalThis, 'fetch', async (url: string) => { calls.push({ url: String(url) }); return new Response('unguarded'); });
  t.mock.method(https, 'request', (url: URL, options: https.RequestOptions, callback: (response: unknown) => void) => {
    calls.push({ url: url.toString(), options });
    const reply = replies[calls.length - 1] ?? {};
    const response = Readable.from(reply.body?.() ?? (reply.chunks ?? ['original-', 'bytes']).map(chunk => Buffer.from(chunk))) as any;
    response.statusCode = reply.status ?? 200;
    response.headers = reply.headers ?? { 'content-type': 'video/mp4', 'content-length': '14' };
    responses.push(response);
    const request = new EventEmitter() as any;
    Object.assign(request, { setTimeout() { return request; }, end() { queueMicrotask(() => callback(response)); return request; }, destroy(error?: Error) { if (error) request.emit('error', error); return request; } });
    return request;
  });
  const { GET } = require(output);
  return { calls, lookups, responses, setUser: (value: string | null) => { user = value; },
    get: (url: string, signal?: AbortSignal, filename = 'clip.mp4') => GET(new NextRequest(`https://app.example/api/download?${new URLSearchParams({ url, filename })}`, { signal })) as Promise<Response> };
}

test('download requires authentication before resolving or fetching any source', async t => {
  const f = await fixture(t); f.setUser(null);
  assert.equal((await f.get('https://files.example/clip.mp4')).status, 401);
  assert.equal(f.calls.length, 0); assert.equal(f.lookups.length, 0);
});

test('download refuses local URLs, credentials, nonstandard ports and insecure transport before connection', async t => {
  const f = await fixture(t);
  for (const url of ['http://127.0.0.1/file', 'https://127.0.0.1/file', 'https://[::1]/file', 'https://[::ffff:127.0.0.1]/file', 'https://user:pass@files.example/file', 'https://files.example:8443/file', 'file:///tmp/file']) {
    const response = await f.get(url);
    if(response.status !== 400) { await response.body?.cancel(); }
    assert.equal(response.status, 400, JSON.stringify({url,calls:f.calls,lookups:f.lookups}));
  }
  assert.equal(f.calls.length, 0);
});

for (const address of ['127.0.0.1', '10.2.3.4', '169.254.169.254', '192.168.1.1', '100.64.0.1', 'fc00::1', '::ffff:127.0.0.1']) {
  test(`download rejects DNS resolving to ${address} including mixed public/private answers`, async t => {
    const f = await fixture(t, [{ address: '8.8.8.8', family: 4 }, { address, family: address.includes(':') ? 6 : 4 }]);
    assert.equal((await f.get('https://files.example/file')).status, 400);
    assert.equal(f.calls.length, 0);
  });
}

test('download validates redirects before connecting to their destination', async t => {
  const f = await fixture(t, undefined, [{ status: 302, headers: { location: 'https://private.example/internal' } }]);
  assert.equal((await f.get('https://files.example/redirect')).status, 400);
  assert.equal(f.calls.length, 1); assert.equal(f.responses[0].destroyed, true);
});

test('download preserves signed originals and pins the validated DNS address', async t => {
  const f = await fixture(t);
  const url = 'https://files.example/original.mp4?X-Signature=a%2Fb&expires=123';
  const response = await f.get(url);
  assert.equal(response.status, 200); assert.equal(await response.text(), 'original-bytes');
  assert.equal(f.calls[0].url, url);
  const lookup = f.calls[0].options?.lookup;
  assert.equal(typeof lookup, 'function');
  const actual = await new Promise(resolve => lookup!('files.example', { all: true }, (_error, addresses) => resolve(addresses)));
  assert.deepEqual(actual, [{ address: '8.8.8.8', family: 4 }]);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="clip.mp4"');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('download follows a bounded public redirect and retains the signed query exactly', async t => {
  const target = 'https://cdn.example/file.mov?token=a%2Bb';
  const f = await fixture(t, undefined, [{ status: 307, headers: { location: target } }, { headers: { 'content-type': 'application/octet-stream' } }]);
  const response = await f.get('https://files.example/start', undefined, 'result.mov');
  assert.equal(await response.text(), 'original-bytes');
  assert.deepEqual(f.calls.map(call => call.url), ['https://files.example/start', target]);
  assert.equal(response.headers.get('content-type'), 'video/quicktime');
  assert.equal(f.responses[0].destroyed, true);
});

test('download rejects oversized and incomplete bodies instead of successful truncated media', async t => {
  const f = await fixture(t, undefined, [{ headers: { 'content-length': String(1024 ** 3 + 1) } }, { headers: { 'content-length': '100' } }]);
  assert.equal((await f.get('https://files.example/large')).status, 502);
  assert.equal(f.responses[0].destroyed, true);
  const truncated = await f.get('https://files.example/truncated');
  await assert.rejects(() => truncated.arrayBuffer());
});

test('download aborts a disconnected request before DNS or upstream work', async t => {
  const f = await fixture(t); const controller = new AbortController(); controller.abort();
  assert.equal((await f.get('https://files.example/clip', controller.signal)).status, 502);
  assert.equal(f.calls.length, 0); assert.equal(f.lookups.length, 0);
});

test('download cancellation closes the upstream without buffering the remaining body', async t => {
  let produced = 0;
  const f = await fixture(t, undefined, [{ headers: { 'content-type': 'video/mp4' }, body: async function* () {
    for (let i = 0; i < 100; i++) { produced++; yield Buffer.alloc(1024); }
  } }]);
  const response = await f.get('https://files.example/stream');
  assert.equal(response.status, 200);
  assert.ok(produced < 100, 'headers are returned before the complete media is consumed');
  await response.body!.cancel();
  assert.equal(f.responses[0].destroyed, true);
  assert.ok(produced < 100);
});

test('download enforces the byte ceiling even when Content-Length is absent', async t => {
  const block = Buffer.alloc(8 * 1024 * 1024);
  const f = await fixture(t, undefined, [{ headers: { 'content-type': 'video/mp4' }, body: async function* () {
    // Reuse one small allocation; no gigabyte file or aggregate buffer is created.
    for (let i = 0; i < 129; i++) yield block;
  } }]);
  const response = await f.get('https://files.example/unbounded');
  const reader = response.body!.getReader();
  await assert.rejects(async () => { while (!(await reader.read()).done) { /* discard each chunk */ } });
  assert.equal(f.responses[0].destroyed, true);
});

test('download refuses redirect loops and closes each intermediate response', async t => {
  const f = await fixture(t, undefined, Array.from({ length: 4 }, () => ({ status: 302, headers: { location: '/loop' } })));
  assert.equal((await f.get('https://files.example/loop')).status, 400);
  assert.equal(f.calls.length, 4);
  assert.ok(f.responses.every(response => response.destroyed));
});

test('download abort during DNS never permits a late answer to open a connection', async t => {
  const f = await fixture(t);
  let resolve!: (value: { address: string; family: number }[]) => void;
  t.mock.method(dns, 'lookup', () => new Promise(done => { resolve = done; }));
  const controller = new AbortController();
  const pending = f.get('https://files.example/wait', controller.signal);
  await new Promise(done => setImmediate(done));
  controller.abort();
  assert.equal((await pending).status, 502);
  resolve([{ address: '8.8.8.8', family: 4 }]);
  await new Promise(done => setImmediate(done));
  assert.equal(f.calls.length, 0);
});
