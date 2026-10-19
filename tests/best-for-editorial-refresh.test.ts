import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BEST_FOR_PAGES, DETAIL_COPY } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config';
import { SELECTION_RATIONALE } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-selection-review';
import { buildRankedPick, resolveTopPicks } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-ranking';
import { selectBestForScenes } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-previews';
import { BEST_FOR_SCENES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-scenes';
import { getModelGuidance } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-model-guidance';
import { buildBestForItemListJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-schema';
import type { GalleryVideo } from '../frontend/server/videos';

const pick = (modelSlug: string, rank = 1) => buildRankedPick({ modelSlug, usecaseSlug: 'image-to-video', rank, copy: DETAIL_COPY.en, locale: 'en' });
test('all current shortlist models have specific, translated reasons and limits independent of rank', () => {
  for (const slug of new Set(BEST_FOR_PAGES.flatMap(page => page.topPicks ?? []))) {
    for (const locale of ['en', 'fr', 'es'] as const) {
      const guidance = getModelGuidance(slug, locale);
      assert.ok(guidance?.reason && guidance.limit && guidance.tag, slug + '/' + locale);
    }
    assert.equal(pick(slug, 1).reason, pick(slug, 5).reason);
    assert.equal(pick(slug, 1).criterion, pick(slug, 5).criterion);
    assert.doesNotMatch(pick(slug).reason, /best balance|strong option|do not assign/i);
  }
  assert.match(getModelGuidance('minimax-h3-max', 'en')!.limit, /1080p/);
  assert.match(getModelGuidance('grok-imagine-video-1-5', 'en')!.limit, /720p/);
});
const scene = BEST_FOR_SCENES[0];
const valid = { id: scene.id, engineId: scene.model, visibility: 'public', indexable: true, videoUrl: 'https://media.example/render.mp4', thumbUrl: 'https://media.example/poster.jpg', durationSec: 8 } as GalleryVideo;
test('curated scenes require the exact public model, playable media and indexability', () => {
  const candidates = [pick(scene.model)];
  assert.equal(selectBestForScenes(candidates, new Map([[scene.id, valid]]), 'fr', 'image-to-video').length, 1);
  for (const override of [{ visibility: 'private' }, { indexable: false }, { engineId: 'veo-3-1' }, { videoUrl: '' }, { thumbUrl: '' }]) {
    assert.deepEqual(selectBestForScenes(candidates, new Map([[scene.id, { ...valid, ...override } as GalleryVideo]]), 'en', ''), []);
  }
  assert.deepEqual(selectBestForScenes(candidates, new Map(), 'en', ''), []);
});
test('scene selection prioritizes the task, stays bounded and never duplicates a render', () => {
  const candidates = BEST_FOR_PAGES.find(p => p.slug === 'lipsync-dialogue')!.topPicks!.map(slug => pick(slug));
  const videos = new Map(BEST_FOR_SCENES.map(s => [s.id, { ...valid, id: s.id, engineId: s.model }]));
  const selected = selectBestForScenes(candidates, videos, 'en', 'lipsync-dialogue');
  assert.ok(selected.some(p => p.example?.id === '4262deb1-ca93-4ced-902a-8e2eae23858d'));
  assert.ok(selected.every(p => BEST_FOR_SCENES.find(s => s.id === p.example?.id)?.usecases.includes('lipsync-dialogue')));
  assert.ok(selected.length <= 3);
  assert.equal(new Set(selected.map(s => s.example!.id)).size, selected.length);
});
test('structured shortlist describes editorial choices without inventing scored reviews', () => {
  const schema = buildBestForItemListJsonLd('fr', [pick('minimax-h3')], 'https://maxvideoai.com/fr/ai-video-engines/best-for/image-to-video');
  assert.equal(schema.itemListOrder, 'https://schema.org/ItemListOrderAscending');
  assert.equal(schema.itemListElement[0].description, pick('minimax-h3').reason);
  assert.doesNotMatch(JSON.stringify(schema), /aggregateRating|reviewRating/);
});
test('public scene playback is deferred and uses the shared manual reader', () => {
  const dir = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/';
  const card = readFileSync(dir + 'BestForSceneCard.client.tsx', 'utf8');
  const dialog = readFileSync(dir + 'BestForSceneDialog.client.tsx', 'utf8');
  assert.match(card, /dynamic\(/); assert.match(card, /ssr: false/); assert.doesNotMatch(card, /<video/);
  assert.match(card, /priority=\{priority\}/); assert.match(card, /event\.metaKey/);
  assert.match(dialog, /PublicVideoPlayer/); assert.match(dialog, /useAccessibleModal/);
  assert.match(dialog, /aria-modal="true"/);
});


test('each authored selection resolves in full without a historical score gate and explains its order in every language', () => {
  for (const page of BEST_FOR_PAGES) {
    assert.deepEqual(resolveTopPicks(page), page.topPicks);
    for (const locale of ['en','fr','es'] as const) assert.ok(SELECTION_RATIONALE[page.slug]?.[locale]);
  }
  assert.match(getModelGuidance('minimax-h3', 'en', 'lipsync-dialogue')!.reason, /voice, words and mouth/);
});
test('4K scene selection requires the exact original resolution, not just a model label', () => {
  const scene = BEST_FOR_SCENES.find(s => s.model === 'kling-o3-4k')!;
  const source = { ...valid, id: scene.id, engineId: scene.model, outputWidth: 3840, outputHeight: 2160 };
  assert.equal(selectBestForScenes([pick(scene.model)], new Map([[scene.id, source]]), 'en', '4k-video').length, 1);
  for (const size of [{outputWidth:1920,outputHeight:1080},{outputWidth:null,outputHeight:null}]) {
    assert.equal(selectBestForScenes([pick(scene.model)], new Map([[scene.id,{...source,...size}]]), 'en', '4k-video').length, 0);
  }
});
