import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { resolveVideoSeoRolloutIds, type PersistedVideoSeoEditorialEntry } from '../frontend/server/video-seo-editorial';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
import type { PublicExampleCard } from '../frontend/server/local-public-examples-data';
import type { getVideoWatchPageDataById } from '../frontend/server/video-seo';

const prompt = 'A cinematic scene showing a dancer performing precise circular movements in a sunlit courtyard. The camera slowly orbits from left to right, preserving natural lighting, stable architecture and coherent realistic motion through a continuous twenty two second landscape shot.';
const video: GalleryVideo = {
  id: 'watch-price-boundary', userId: 'private-owner', engineId: 'wan-3-prime', engineLabel: 'Wan 3 Prime',
  prompt, promptExcerpt: prompt, durationSec: 22, aspectRatio: '16:9', outputWidth: 1280, outputHeight: 720,
  hasAudio: true, createdAt: '2026-09-20T12:00:00Z', visibility: 'public', indexable: true, canUpscale: false,
  videoUrl: 'https://media.maxvideoai.com/watch-price-boundary.mp4', thumbUrl: 'https://media.maxvideoai.com/watch-price-boundary.webp',
  finalPriceCents: 401, currency: 'USD',
  settingsSnapshot: { inputMode: 't2v', core: { durationSec: 22, resolution: '720p', aspectRatio: '16:9', audio: true } },
};
const editorial: PersistedVideoSeoEditorialEntry = {
  id: video.id, seoStatus: 'approved', seoTitle: 'Wan dance film — MaxVideoAI',
  metaDescription: 'Watch an original Wan dance film with a continuous camera orbit, natural lighting and the complete generation prompt.',
  h1: 'Wan 3 Prime cinematic dance in a sunlit courtyard', videoObjectName: 'Wan dance film',
  shortDescription: 'An original Wan 3 Prime dance film, with a continuous camera orbit around a sunlit courtyard and realistic choreography in a single flowing shot.',
  targetKeyword: 'Wan dance film', intent: 'camera-motion', modelSlug: 'wan-3-prime', examplesSlug: 'wan',
  canonicalSlug: 'wan-dance-film-price-boundary', updatedAt: '2026-09-21T12:00:00Z', rolloutExcluded: false,
  source: 'database', notes: null, updatedBy: null,
};
const localCard: PublicExampleCard = {
  id: 'local-price-boundary', engineIconId: 'wan-3-prime', engineLabel: 'Wan 3 Prime',
  prompt: 'Local public excerpt', promptFull: prompt, durationSec: 22, hasAudio: true, priceLabel: '$4.01',
  videoUrl: 'https://media.maxvideoai.com/local-price-boundary.mp4', rawPosterUrl: 'https://media.maxvideoai.com/local-price-boundary.webp',
};
type Fixture = {
  local: boolean; videos: Record<string, GalleryVideo>; editorials: Record<string, PersistedVideoSeoEditorialEntry>;
  localCards: Record<string, PublicExampleCard>; ownerPriceCalls: number; events: string[];
  resolveRolloutIds: typeof resolveVideoSeoRolloutIds;
};

async function loadRealOwner() {
  // Keep the owner, signal/canonical/related builders and local card converter real.
  // Only service reads and React's unavailable Node cache boundary are replaced.
  const fixture = 'globalThis.__watchNoUnusedPriceFixture';
  const localData = JSON.stringify(resolve('frontend/server/local-public-examples-data.ts'));
  const mocks: Record<string, string> = {
    react: 'export const cache = fn => fn;',
    './local-public-examples': `import {publicCardToVideo} from ${localData};export const isLocalPublicExamplesEnabled=()=>${fixture}.local;export function getLocalPublicExample(id){const f=${fixture};f.events.push('local:'+id);return f.localCards[id]?publicCardToVideo(f.localCards[id]):null;}`,
    '@/server/videos': `export async function getSeoVideosByIds(ids){const f=${fixture};f.events.push('selected');return new Map(ids.flatMap(id=>f.videos[id]?[[id,f.videos[id]]]:[]));}export async function getSeoVideoById(id){const f=${fixture};f.events.push('video:'+id);return f.videos[id]??null;}`,
    '@/server/video-seo-editorial': `export async function listVideoSeoEditorialEntryMap(){const f=${fixture};f.events.push('editorial');return new Map(Object.entries(f.editorials));}export const resolveVideoSeoRolloutIds=(...args)=>${fixture}.resolveRolloutIds(...args);export async function getResolvedVideoSeoEditorialEntryByIdentifier(id){const f=${fixture};f.events.push('identifier:'+id);return Object.values(f.editorials).find(e=>e.id===id||e.canonicalSlug===id)??null;}`,
    '@/server/watch-source-image-originals': `export async function resolveWatchSourceImageOriginalUrls({sourceImages}){${fixture}.events.push('source-images');return sourceImages;}`,
    '@/server/current-example-price': `export async function quoteCurrentExamplePrice(){${fixture}.ownerPriceCalls++;throw Error('UNUSED_WATCH_PRICE_READ');}`,
  };
  const output = await build({
    entryPoints: ['frontend/server/video-seo.ts'], bundle: true, write: false, platform: 'node', format: 'cjs',
    packages: 'external', tsconfig: 'frontend/tsconfig.json',
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
    plugins: [{ name: 'watch-owner-read-boundaries', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path)
        ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'js', resolveDir: process.cwd() }));
    } }],
  });
  const compiledModule = { exports: {} as { getVideoWatchPageDataById: typeof getVideoWatchPageDataById } };
  new Function('module', 'exports', 'require', output.outputFiles[0].text)(compiledModule, compiledModule.exports, createRequire(resolve('frontend/package.json')));
  return compiledModule.exports.getVideoWatchPageDataById;
}

test('watch data preserves public semantics without an unused current-price dependency', async t => {
  const owner = await loadRealOwner();
  const globals = globalThis as typeof globalThis & { __watchNoUnusedPriceFixture?: Fixture };
  t.after(() => { delete globals.__watchNoUnusedPriceFixture; });
  for (const scenario of ['selected ID', 'selected canonical slug', 'unselected', 'rollout excluded', 'local'] as const) {
    await t.test(scenario, async () => {
      const selected = scenario.startsWith('selected');
      const local = scenario === 'local';
      const withEditorial = selected || scenario === 'rollout excluded';
      const f: Fixture = {
        local, videos: { [video.id]: video }, localCards: { [localCard.id]: localCard },
        editorials: withEditorial ? { [video.id]: { ...editorial, rolloutExcluded: !selected } } : {},
        ownerPriceCalls: 0, events: [], resolveRolloutIds: resolveVideoSeoRolloutIds,
      };
      globals.__watchNoUnusedPriceFixture = f;
      const id = local ? localCard.id : scenario === 'selected canonical slug' || scenario === 'rollout excluded'
        ? 'wan-dance-film-price-boundary' : video.id;
      const page = await owner(id);
      assert.ok(page);
      assert.equal(f.ownerPriceCalls, 0);
      assert.equal(Object.hasOwn(page, 'currentPrice'), false, 'price preparation belongs to the reader context');
      assert.equal(page.isSelected, selected);
      assert.equal(page.isEligible, selected);
      assert.equal(page.video.id, local ? 'local-price-boundary' : 'watch-price-boundary');
      assert.equal(page.video.prompt, prompt);
      assert.equal(page.video.videoUrl, local ? 'https://media.maxvideoai.com/local-price-boundary.mp4' : 'https://media.maxvideoai.com/watch-price-boundary.mp4');
      assert.equal(page.video.thumbUrl, local ? 'https://media.maxvideoai.com/local-price-boundary.webp' : 'https://media.maxvideoai.com/watch-price-boundary.webp');
      assert.equal(page.video.visibility, 'public');
      assert.equal(page.video.finalPriceCents, 401, 'the stored historical amount remains intact');
      assert.equal(page.signals.canonicalSlug, withEditorial ? 'wan-dance-film-price-boundary' : null);
      assert.equal(page.signals.expectedCanonicalUrl, 'https://maxvideoai.com/video/' + (withEditorial ? 'wan-dance-film-price-boundary' : page.video.id));
      assert.equal(page.entry?.id ?? null, withEditorial ? 'watch-price-boundary' : null);
      if (withEditorial) {
        assert.equal(page.signals.title, 'Wan 3 Prime cinematic dance in a sunlit courtyard');
        assert.equal(page.signals.metaTitle, 'Wan dance film — MaxVideoAI');
        assert.deepEqual(page.signals.editorialQaErrors, []);
      }
      assert.deepEqual(page.related, []);
      assert.ok(local ? f.events.every(event => event.startsWith('local:')) : f.events.includes('source-images'));
    });
  }
  for (const scenario of ['missing', 'private filtered by public reader', 'local missing'] as const) {
    await t.test(scenario, async () => {
      const f: Fixture = { local: scenario === 'local missing', videos: {}, editorials: {}, localCards: {}, ownerPriceCalls: 0, events: [], resolveRolloutIds: resolveVideoSeoRolloutIds };
      globals.__watchNoUnusedPriceFixture = f;
      assert.equal(await owner(scenario), null);
      assert.equal(f.ownerPriceCalls, 0);
      assert.equal(f.events.includes('source-images'), false);
    });
  }
});
