import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

type Fixture = {
  userId: string | null;
  historyReads: number;
  playlistLimits: number[];
  videos: Array<Record<string, unknown>>;
};
const frontend = resolve('frontend');
const stubs: Record<string, string> = {
  '@/lib/supabase-ssr': 'export const getRouteAuthContext = async () => ({ userId: fixture.userId });',
  '@/lib/db': 'export const query = async () => { fixture.historyReads++; return []; };',
  '@/server/videos': 'export const listStarterPlaylistVideos = async limit => { fixture.playlistLimits.push(limit); return fixture.videos.slice(0, limit); };',
  '@/server/seedance-workflow-request': 'export const seedanceWorkflowEnabled = () => false;',
  'next/headers': 'export const headers = async () => ({ get: () => "localhost" });',
  './AppClient': 'export default function AppClient() { return null; }',
};
const bundled = build({
  absWorkingDir: frontend,
  stdin: { contents: "export { default as Page } from './app/(core)/(workspace)/app/page';", resolveDir: frontend, loader: 'ts' },
  tsconfig: resolve(frontend, 'tsconfig.json'), bundle: true, platform: 'node', format: 'cjs',
  packages: 'external', write: false, jsx: 'automatic',
  plugins: [{ name: 'starter-preview-fixture', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});

async function load(userId: string | null = null) {
  const fixture: Fixture = { userId, historyReads: 0, playlistLimits: [], videos: [
    { id: 'starter-first', videoUrl: 'https://example.com/first.mp4', thumbUrl: 'https://example.com/first.jpg',
      previewVideoUrl: 'https://example.com/first-preview.mp4', aspectRatio: '16:9', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'starter-second', videoUrl: 'https://example.com/second.mp4', createdAt: '2026-10-01T00:00:00Z' },
  ] };
  const module = { exports: {} as {
    Page: (props: { searchParams: Promise<Record<string, string>> }) => Promise<{ props: { initialPreviewGroup: { items: Array<{ jobId: string; url: string; thumb: string; previewUrl: string; meta: { curated: boolean } }> } | null } }>;
  } };
  new Function('require', 'module', 'exports', 'fixture', (await bundled).outputFiles[0].text)(
    createRequire(resolve(frontend, 'package.json')), module, module.exports, fixture);
  return { fixture, ...module.exports };
}

test('direct guest entries server-render the first editorial Starter video with its poster and preview', async () => {
  for (const query of [{}, { tab: 'starter' }]) {
    const { Page, fixture } = await load();
    const page = await Page({ searchParams: Promise.resolve(query) });
    const item = page.props.initialPreviewGroup?.items[0];
    assert.equal(item?.jobId, 'starter-first', 'playlist order wins over the newer second item');
    assert.equal(item?.url, 'https://example.com/first.mp4');
    assert.equal(item?.thumb, 'https://example.com/first.jpg');
    assert.equal(item?.previewUrl, 'https://example.com/first-preview.mp4');
    assert.equal(item?.meta.curated, true);
    assert.deepEqual(fixture.playlistLimits, [1]);
    assert.equal(fixture.historyReads, 0);
  }
});

test('signed-in model links do not substitute history or public samples', async () => {
  const { Page, fixture } = await load('signed-in-user');
  assert.equal((await Page({ searchParams: Promise.resolve({ engine: 'wan-3-prime' }) })).props.initialPreviewGroup, null);
  assert.equal(fixture.historyReads, 0);
  assert.deepEqual(fixture.playlistLimits, []);
});

test('example, reuse and model links keep their own preview lookup', async () => {
  for (const query of [{ job: 'job_requested' }, { from: 'source-video', engine: 'wan-3-prime' }, { engine: 'wan-3-prime' }, { engineId: 'seedance-2-5' }]) {
    const { Page, fixture } = await load();
    assert.equal((await Page({ searchParams: Promise.resolve(query) })).props.initialPreviewGroup, null);
    assert.deepEqual(fixture.playlistLimits, []);
    assert.equal(fixture.historyReads, 0);
  }
});

test('an empty Starter collection keeps the existing empty fallback', async () => {
  const { Page, fixture } = await load();
  fixture.videos = [];
  assert.equal((await Page({ searchParams: Promise.resolve({}) })).props.initialPreviewGroup, null);
});

