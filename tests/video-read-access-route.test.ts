import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('video GET preserves public sharing and limits private videos to their owner', async (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'video-read-access-'));
  const fixture = {
    configured: true, userId: null as string | null, authCalls: 0,
    video: null as Record<string, unknown> | null,
  };
  const globals = globalThis as typeof globalThis & { __videoReadFixture?: typeof fixture };
  globals.__videoReadFixture = fixture;
  t.after(() => { delete globals.__videoReadFixture; rmSync(folder, { recursive: true, force: true }); });
  const output = join(folder, 'route.cjs');
  await build({
    entryPoints: ['frontend/app/api/videos/[videoId]/route.ts'], outfile: output,
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'video-read-fixtures', setup(builder) {
      const mocks: Record<string, string> = {
        '@/lib/db': 'export function isDatabaseConfigured(){return globalThis.__videoReadFixture.configured;}',
        '@/lib/schema': 'export async function ensureBillingSchema(){}',
        '@/server/videos': 'export async function getVideoById(){return globalThis.__videoReadFixture.video;} export async function updateVideoIndexableForUser(){throw new Error("No writes in GET tests");}',
        '@/lib/supabase-ssr': 'export async function getRouteAuthContext(){globalThis.__videoReadFixture.authCalls++; return {userId:globalThis.__videoReadFixture.userId};}',
      };
      builder.onResolve({ filter: /.*/ }, (args) => args.path in mocks
        ? { path: args.path, namespace: 'fixture' }
        : args.path === 'next/server' ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: mocks[args.path], loader: 'ts' }));
    } }],
  });
  const { GET } = requireFrontend(output) as { GET(req: Request, props: { params: Promise<{ videoId: string }> }): Promise<Response> };
  const request = () => GET(new Request('http://localhost/api/videos/example'), { params: Promise.resolve({ videoId: 'example' }) });
  const video = { id: 'example', userId: 'owner', visibility: 'public', indexable: true, prompt: 'Example prompt', videoUrl: 'https://example.test/video.mp4' };

  await t.test('public videos stay readable anonymously even when excluded from search', async () => {
    for (const indexable of [true, false]) {
      fixture.video = { ...video, indexable }; fixture.authCalls = 0; fixture.userId = null;
      const response = await request();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, video: fixture.video });
      assert.equal(fixture.authCalls, 0);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
  });
  await t.test('private videos are indistinguishable from missing ones for guests and other accounts', async () => {
    for (const userId of [null, 'other-user']) {
      fixture.video = { ...video, visibility: 'private' }; fixture.userId = userId;
      const denied = await request();
      fixture.video = null;
      const missing = await request();
      assert.equal(denied.status, 404);
      assert.equal(missing.status, 404);
      assert.deepEqual(await denied.json(), await missing.json());
      assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    }
  });
  await t.test('the owner can still reuse a private video without exposing extra settings', async () => {
    fixture.video = { ...video, visibility: 'private' }; fixture.userId = 'owner';
    const response = await request();
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.video, fixture.video);
    assert.equal('settingsSnapshot' in payload.video, false);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });
  await t.test('a private video with no owner fails closed and unavailable data stays a 503', async () => {
    fixture.video = { ...video, visibility: 'private', userId: null }; fixture.userId = null;
    assert.equal((await request()).status, 404);
    fixture.configured = false;
    assert.equal((await request()).status, 503);
  });
});
