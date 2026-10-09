import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { build } from 'esbuild';

import { pickFirstPlayableVideo } from '../frontend/lib/examples/heroVideo';
import { normalizeMediaUrl } from '../frontend/lib/media';
import { publicCardToVideo, selectLocalPublicExamples, type PublicExamplesSnapshot } from '../frontend/server/local-public-examples-data';
import type { GalleryVideo, ListExamplesPageOptions, ListExamplesPageResult } from '../frontend/server/videos';

type Read = (family: string, options: Omit<ListExamplesPageOptions, 'engineGroup'>) => Promise<ListExamplesPageResult>;
const requireFrontend = createRequire(resolve('frontend/package.json'));
const folder = mkdtempSync(join(tmpdir(), 'family-metadata-test-'));
let route: { generateMetadata: (props: unknown) => Promise<any>; setReader: (read: Read) => void;
  selectFamilyMetadataVideo: (family: string, read?: Read) => Promise<GalleryVideo | null> };

before(async () => {
  const output = join(folder, 'metadata.cjs');
  await build({
    stdin: { contents: `export { generateMetadata } from './frontend/app/(localized)/[locale]/(marketing)/examples/[model]/page';
      export { selectFamilyMetadataVideo } from './frontend/app/(localized)/[locale]/(marketing)/examples/[model]/_lib/family-metadata-video';
      export { setReader } from '@/server/videos';`, resolveDir: process.cwd() },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'metadata-boundaries', setup(builder) {
      builder.onResolve({ filter: /^@\/server\/videos$/ }, () => ({ path: 'reader', namespace: 'fixture' }));
      builder.onLoad({ filter: /^reader$/, namespace: 'fixture' }, () => ({
        contents: 'let read; export const setReader = value => { read = value; }; export const listExampleFamilyPage = (...args) => read(...args);', loader: 'js',
      }));
      builder.onResolve({ filter: /^\.\.\/page$/ }, args => args.importer.endsWith('/examples/[model]/page.tsx')
        ? { path: 'gallery-page', namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /^gallery-page$/, namespace: 'fixture' }, () => ({ contents: 'export default function Page() {}', loader: 'js' }));
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
      builder.onLoad({ filter: /^navigation$/, namespace: 'fixture' }, () => ({
        contents: 'export const notFound = () => { throw Error("notFound"); }; export const permanentRedirect = href => { throw Error(href); };', loader: 'js',
      }));
    } }],
  });
  route = requireFrontend(output);
});
after(() => rmSync(folder, { recursive: true, force: true }));

function video(id: string, source: string | undefined = `https://media.maxvideoai.com/${id}.mp4`, thumb = `https://media.maxvideoai.com/${id}.webp`): GalleryVideo {
  return publicCardToVideo({ id, engineIconId: 'kling-3-pro', engineLabel: 'Kling 3 Pro', prompt: `Prompt ${id}`, durationSec: 5, hasAudio: false, videoUrl: source, rawPosterUrl: thumb });
}
function fixture(items: GalleryVideo[]) {
  const calls: { family: string; sort: unknown; limit: number; offset: number }[] = [];
  const read: Read = async (family, options) => {
    const { sort, limit = 150, offset = 0 } = options;
    calls.push({ family, sort, limit, offset });
    return { items: items.slice(offset, offset + limit), total: items.length, limit, offset, hasMore: offset + limit < items.length };
  };
  route.setReader(read);
  return calls;
}
const metadata = (locale = 'en', searchParams = {}) => route.generateMetadata({ params: Promise.resolve({ locale, model: 'kling' }), searchParams: Promise.resolve(searchParams) });
const ogImage = (result: any) => result.openGraph.images[0].url;

test('the metadata selector accepts an isolated reader and preserves the complete selected video', async () => {
  const selected = { ...video('injected'), settingsSnapshot: { fps: 24 }, prompt: 'Complete original prompt' };
  const calls: unknown[] = [];
  const result = await route.selectFamilyMetadataVideo('seedance', async (family, options) => {
    calls.push({ family, ...options });
    return { items: [selected], total: 1, limit: 1, offset: 0, hasMore: false };
  });
  assert.deepEqual(result, selected);
  assert.deepEqual(calls, [{ family: 'seedance', sort: 'playlist', limit: 1, offset: 0 }]);
});

test('family metadata hydrates one playlist item when its original video is playable', async () => {
  const calls = fixture(Array.from({ length: 65 }, (_, index) => video(String(index + 1))));
  assert.equal(ogImage(await metadata()), 'https://media.maxvideoai.com/1.webp');
  assert.deepEqual(calls, [{ family: 'kling', sort: 'playlist', limit: 1, offset: 0 }]);
});

test('empty metadata reads keep the brand image without retrying the catalog', async () => {
  const calls = fixture([]);
  assert.match(ogImage(await metadata()), /\/og\/brand-2026-09-25\.png$/);
  assert.deepEqual(calls.map(call => call.limit), [1]);
});

test('a playable first video without a thumbnail keeps the brand image ahead of later posters', async () => {
  const calls = fixture([video('first', undefined, ''), video('later')]);
  assert.match(ogImage(await metadata()), /\/og\/brand-2026-09-25\.png$/);
  assert.deepEqual(calls.map(call => call.limit), [1]);
});

test('normalized empty sources retry the original selection window, including its sixtieth item', async () => {
  for (const raw of ['\t', '\u00a0', ' \t\u00a0 ']) {
    const normalized = normalizeMediaUrl(raw) ?? undefined;
    assert.equal(normalized, undefined);
    const items = Array.from({ length: 61 }, (_, index) => ({ ...video(String(index + 1)), videoUrl: index < 59 ? normalized : video(String(index + 1)).videoUrl }));
    const calls = fixture(items);
    assert.equal(ogImage(await metadata()), 'https://media.maxvideoai.com/60.webp');
    assert.deepEqual(calls.map(call => call.limit), [1, 60]);
    assert.equal(pickFirstPlayableVideo(items.slice(0, 60))?.id, '60');
  }
});

test('metadata does not search beyond the existing sixty-item window', async () => {
  const items = Array.from({ length: 61 }, (_, index) => ({ ...video(String(index + 1)), videoUrl: index < 60 ? undefined : 'https://media.maxvideoai.com/61.mp4' }));
  const calls = fixture(items);
  assert.match(ogImage(await metadata()), /\/og\/brand-2026-09-25\.png$/);
  assert.deepEqual(calls.map(call => call.limit), [1, 60]);
});

test('first-read and compatibility-read failures propagate the original error', async () => {
  for (const failureLimit of [1, 60]) {
    const failure = new Error(`failed limit ${failureLimit}`);
    route.setReader(async (_family, { limit = 150, offset = 0 }) => {
      if (limit === failureLimit) throw failure;
      return { items: [{ ...video('invalid'), videoUrl: undefined }], total: 1, limit, offset, hasMore: false };
    });
    await assert.rejects(metadata(), error => error === failure);
  }
});

test('local snapshot selection retains the captured playlist preview, including an unplayable first item', async () => {
  const snapshot: PublicExamplesSnapshot = { version: 1, source: 'https://maxvideoai.com/api/examples', capturedAt: '2026-10-09',
    cards: { first: { id: 'first', engineIconId: 'kling-3-pro', engineLabel: 'Kling', prompt: 'First', durationSec: 5, hasAudio: false },
      later: { id: 'later', engineIconId: 'kling-3-pro', engineLabel: 'Kling', prompt: 'Later', durationSec: 5, hasAudio: false, videoUrl: 'https://media.maxvideoai.com/local.mp4', rawPosterUrl: '/local.webp' } },
    feeds: { kling: { playlist: ['first', 'later'], 'date-desc': ['later', 'first'] } } };
  const limits: number[] = [];
  route.setReader(async (family, { sort, limit = 150, offset = 0 }) => { limits.push(limit); return selectLocalPublicExamples(snapshot, family, sort, limit, offset); });
  assert.match(ogImage(await metadata()), /\/local\.webp$/);
  assert.deepEqual(limits, [1, 60]);
});

test('EN/FR/ES alternate sorts and pages preserve playlist OG identity, canonical and hreflang', async () => {
  for (const locale of ['en', 'fr', 'es']) {
    const calls = fixture([video('playlist-first'), video('date-first')]);
    const baseline = await metadata(locale);
    const filtered = await metadata(locale, { sort: 'date-desc', page: '2' });
    assert.equal(ogImage(filtered), 'https://media.maxvideoai.com/playlist-first.webp');
    assert.deepEqual(filtered.alternates, baseline.alternates);
    assert.deepEqual(filtered.openGraph, baseline.openGraph);
    assert.deepEqual(filtered.twitter, baseline.twitter);
    assert.deepEqual(filtered.title, baseline.title);
    assert.equal(filtered.description, baseline.description);
    assert.equal(baseline.robots.index, true);
    assert.equal(filtered.robots.index, false);
    assert.deepEqual(calls, Array.from({ length: 2 }, () => ({ family: 'kling', sort: 'playlist', limit: 1, offset: 0 })));
  }
});
