import assert from 'node:assert/strict';
import test from 'node:test';

import { HERO_ENGINE_MEDIA, HERO_VIDEO_ORDER } from '../frontend/components/marketing/home/home-redesign-visuals';
import manifestConfig from '../frontend/config/public-video-renditions.manifest.json';
import projectionConfig from '../frontend/config/public-video-renditions.generated.json';
import sourceConfig from '../frontend/config/public-video-sources.json';
import type { PublicVideoRenditionProjection } from '../frontend/lib/public-video-renditions';
import { checkCriticalHomeVideoCoverage } from '../frontend/scripts/_lib/public-video-coverage';
import {
  buildPublicProjection,
  type PublicVideoSource,
  type PublishedManifest,
} from '../frontend/scripts/_lib/public-video-renditions';

function currentInput() {
  return {
    heroVideoOrder: [...HERO_VIDEO_ORDER] as string[],
    heroEngineMedia: Object.fromEntries(
      Object.entries(HERO_ENGINE_MEDIA).map(([id, media]) => [id, { videoSrc: media.videoSrc }]),
    ),
    sources: sourceConfig.sources.map((source) => ({ ...source, role: 'public-demo' as const })) as PublicVideoSource[],
    manifest: structuredClone(manifestConfig) as PublishedManifest,
    projection: structuredClone(projectionConfig) as PublicVideoRenditionProjection,
  };
}

function entryForHero(input: ReturnType<typeof currentInput>, heroId: string) {
  const sourceUrl = input.heroEngineMedia[heroId]?.videoSrc;
  const source = input.sources.find((candidate) => candidate.url === sourceUrl);
  assert.ok(source, `expected source for ${heroId}`);
  const entry = input.manifest.entries.find((candidate) => candidate.assetId === source.assetId);
  assert.ok(entry, `expected manifest entry for ${heroId}`);
  return entry;
}

test('all five selected critical homepage videos have coherent ready coverage', () => {
  const input = currentInput();
  assert.equal(input.heroVideoOrder.length, 5);
  assert.doesNotThrow(() => checkCriticalHomeVideoCoverage(input));
});

test('a newly selected unregistered homepage source fails with the hero identity and URL', () => {
  const input = currentInput();
  const sourceUrl = 'https://media.maxvideoai.com/renders/new/unregistered.mp4';
  input.heroVideoOrder.push('future-hero');
  input.heroEngineMedia['future-hero'] = { videoSrc: sourceUrl };

  assert.throws(
    () => checkCriticalHomeVideoCoverage(input),
    (error: Error) => error.message.includes('future-hero') && error.message.includes(sourceUrl),
  );
});

test('surrounding whitespace does not normalize a critical source into a registered URL', () => {
  const input = currentInput();
  const heroId = input.heroVideoOrder[0]!;
  const sourceUrl = input.heroEngineMedia[heroId]!.videoSrc!;
  input.heroEngineMedia[heroId] = { videoSrc: `${sourceUrl} ` };

  assert.throws(
    () => checkCriticalHomeVideoCoverage(input),
    (error: Error) => error.message.includes(heroId) && error.message.includes('unregistered public video source'),
  );
});

test('a selected homepage item without a video URL fails with the hero identity', () => {
  const input = currentInput();
  input.heroVideoOrder.push('missing-video');
  input.heroEngineMedia['missing-video'] = {};

  assert.throws(
    () => checkCriticalHomeVideoCoverage(input),
    /Critical homepage hero "missing-video" is missing its full-duration videoSrc/,
  );
});

test('a stale generated projection fails through the shared state validator', () => {
  const input = currentInput();
  const sourceUrl = input.sources[0]!.url;
  input.projection.renditions[sourceUrl]!.mobile = sourceUrl;

  assert.throws(
    () => checkCriticalHomeVideoCoverage(input),
    /Generated projection is stale or hand-edited/,
  );
});

test('a pending-only profile does not establish critical homepage readiness', () => {
  const input = currentInput();
  const entry = entryForHero(input, 'minimax-h3-max');
  const mobile = entry.renditions.mobile!;
  delete entry.renditions.mobile;
  entry.pendingRenditions.mobile = { ...mobile, httpCheck: null, activatedAt: null };
  input.projection = buildPublicProjection(input.manifest);

  assert.throws(
    () => checkCriticalHomeVideoCoverage(input),
    /minimax-h3-max.*no ready mobile path/,
  );
});

test('a validated intentional omission keeps the original as a ready profile path', () => {
  const input = currentInput();
  input.heroVideoOrder = ['ltx-2-5-pro'];

  assert.doesNotThrow(() => checkCriticalHomeVideoCoverage(input));
});

test('a retryable operational failure without an active rendition or omission is not ready', () => {
  const input = currentInput();
  const entry = entryForHero(input, 'seedance-2-5');
  delete entry.renditions.desktop;
  entry.failures.push({ profile: 'desktop', reason: 'encoder unavailable', retryable: true });
  input.projection = buildPublicProjection(input.manifest);

  assert.throws(
    () => checkCriticalHomeVideoCoverage(input),
    /seedance-2-5.*no ready desktop path/,
  );
});

test('removing a failed replacement candidate retains readiness from the old active rendition', () => {
  const input = currentInput();
  const entry = entryForHero(input, 'wan-3-prime');
  const oldActive = entry.renditions.desktop!;
  const replacementSha = 'f'.repeat(64);
  const storageKey = `marketing/video-renditions/${entry.original.sha256}/public-demo-v1/desktop/${replacementSha}.mp4`;
  entry.pendingRenditions.desktop = {
    ...oldActive,
    url: `https://media.maxvideoai.com/${storageKey}`,
    storageKey,
    sha256: replacementSha,
    httpCheck: null,
    activatedAt: null,
  };
  assert.doesNotThrow(() => checkCriticalHomeVideoCoverage(input));

  delete entry.pendingRenditions.desktop;
  entry.failures.push({ profile: 'desktop', reason: 'replacement encode failed', retryable: true });

  assert.equal(entry.renditions.desktop, oldActive);
  assert.doesNotThrow(() => checkCriticalHomeVideoCoverage(input));
});
