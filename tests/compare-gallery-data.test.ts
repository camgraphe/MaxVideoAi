import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { selectCompareGalleryVideos } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-gallery-data';
import type { GalleryVideo } from '../frontend/server/videos';

const sample = (id: string, overrides: Partial<GalleryVideo> = {}): GalleryVideo => ({
  id, engineId: 'minimax-h3', engineLabel: 'MiniMax H3', visibility: 'public',
  videoUrl: `https://media.example/${id}.mp4`, thumbUrl: `https://media.example/${id}.jpg`,
  previewVideoUrl: `https://media.example/${id}-preview.mp4`, durationSec: 12,
  aspectRatio: '16:9', hasAudio: true, userId: 'never-expose', prompt: 'private-field',
  promptExcerpt: '', createdAt: '2026-09-15', indexable: true, ...overrides,
} as GalleryVideo);

test('comparison gallery excludes sibling models, private videos and unusable media', () => {
  const result = selectCompareGalleryVideos([
    sample('sibling', {engineId: 'minimax-h3-max'}), sample('private', {visibility: 'private'}),
    sample('no-poster', {thumbUrl: null}), sample('no-video', {videoUrl: null}), sample('valid'),
  ], 'minimax-h3', 'minimax-h3');
  assert.deepEqual(result.map(v=>v.id), ['valid']);
});

test('comparison gallery deduplicates before limiting to three actual model examples', () => {
  const result = selectCompareGalleryVideos([sample('a'), sample('a'), sample('b'), sample('c'), sample('d')], 'minimax-h3', 'minimax-h3');
  assert.deepEqual(result.map(v=>v.id), ['a','b','c']);
});

test('comparison gallery preserves exact media identity and strips unrelated user fields', () => {
  const [item] = selectCompareGalleryVideos([sample('a')], 'minimax-h3', 'minimax-h3');
  assert.deepEqual(item, {id:'a', poster:'https://media.example/a.jpg', video:'https://media.example/a.mp4', preview:'https://media.example/a-preview.mp4',duration:12,aspectRatio:'16:9',hasAudio:true});
});

test('comparison gallery does not substitute another model when no examples exist', () => {
  assert.deepEqual(selectCompareGalleryVideos([sample('a')], 'wan-3', 'wan-3'), []);
});

test('comparison media remains optional, prelaunch-gated and reader-owned', () => {
  const root = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/';
  const loader=readFileSync(root+'_lib/compare-gallery-loader.ts','utf8');
  assert.ok(loader.indexOf('if (isPrelaunch) return []') < loader.indexOf('await listPlaylistVideos'));
  assert.match(loader, /catch\s*\{[\s\S]*return \[\]/);
  const card=readFileSync(root+'_components/CompareGalleryCard.client.tsx','utf8');
  assert.match(card, /useExampleCardPlayback/);
  assert.match(card, /visible && intent/);
  assert.match(card, /preload="none"/);
  assert.doesNotMatch(card, /autoPlay|priority[=\s]/);
  const content=readFileSync(root+'_components/CompareDetailContent.tsx','utf8');
  assert.ok(content.indexOf('<CompareEngineHeroCards') < content.indexOf('<CompareModelGalleries'));
  assert.ok(content.indexOf('<CompareModelGalleries') < content.indexOf('<CompareScorecardSection'));
});

test('model and comparison capability descriptions share exact localized limits', async () => {
  const {localizeCapabilityDetail} = await import('../frontend/lib/marketing/spec-capability-copy');
  const {localizeSpecDetailValue} = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values');
  const labels={pending:'À confirmer',supported:'Pris en charge',notSupported:'Non pris en charge'};
  assert.equal(localizeSpecDetailValue('Up to 9 image references','fr',labels), 'Jusqu’à 9 images de référence');
  assert.equal(localizeSpecDetailValue('Native stereo audio','es',labels), 'Audio estéreo nativo');
  assert.equal(localizeSpecDetailValue('New unverified capability','fr',labels), 'New unverified capability');
  assert.equal(localizeCapabilityDetail('Up to 3 clips, 15s total','es'), 'Hasta 3 clips, 15 s en total');
  const model=readFileSync('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-status.ts','utf8');
  assert.match(model, /from '@\/lib\/marketing\/spec-capability-copy'/);
});
