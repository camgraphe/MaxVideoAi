import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExampleGalleryVideo } from '../frontend/components/examples/ExamplesGalleryGrid.tsx';
import {
  getHeroMediaBadges,
  pickDemoMedia,
  pickHeroMedia,
  type FeaturedMedia,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';
import { requiresPinnedModelPromptingDemo } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-prompt-source.ts';

const fallback: FeaturedMedia = {
  id: 'fallback',
  prompt: 'Fallback',
  videoUrl: 'https://example.com/fallback.mp4',
  posterUrl: null,
};

function card(id: string, aspectRatio: string): ExampleGalleryVideo {
  return {
    id,
    href: `/video/${id}`,
    engineLabel: 'Seedance 2.5',
    prompt: 'Example render',
    aspectRatio,
    durationSec: 24,
    hasAudio: true,
    videoUrl: `https://example.com/${id}.mp4`,
    rawPosterUrl: `https://example.com/${id}.jpg`,
  };
}

test('a model hero prefers a playable landscape clip over the first portrait playlist item', () => {
  const portrait = card('portrait', '9:16');
  const landscape = card('landscape', '16:9');
  assert.equal(pickHeroMedia([portrait, landscape], null, fallback).id, 'landscape');
  assert.equal(pickHeroMedia([portrait, landscape], portrait.id, fallback).id, 'landscape');
});

test('Seedance 2.5 and Veo 3.1 pin reviewed clips from their own models', () => {
  assert.equal(PREFERRED_MEDIA['seedance-2-5']?.hero, 'job_ff94f180-0a2f-4f2b-acb2-bda8352fa9d9');
  assert.equal(PREFERRED_MEDIA['veo-3-1']?.hero, 'job_680c9803-172b-4179-950b-e56d288456c2');
});

test('Max pins the selected Unavailable hero and After the Bell Prompt Lab to their adopted jobs', () => {
  assert.deepEqual(PREFERRED_MEDIA['flux-3-max'], {
    hero: 'job_external_fal_38061bc977ff126b5248f9f835436a9370a2f7bb',
    demo: 'job_external_fal_348334c2377e9d31bda23c030095861ad2e9d55c',
  });
});

test('a pinned Prompt Lab waits for its selected scene without borrowing another clip or hero fallback', () => {
  const other = card('other-scene', '16:9');
  const selected = card('selected-scene', '16:9');
  const requirePreferred = requiresPinnedModelPromptingDemo('flux-3-max');
  assert.equal(requirePreferred, true);
  assert.equal(requiresPinnedModelPromptingDemo('flux-3'), false);
  assert.equal(pickDemoMedia([other], other.id, null, fallback, { requirePreferred }), null);
  assert.equal(pickDemoMedia([other], other.id, selected.id, fallback, { requirePreferred }), null);
  assert.equal(pickDemoMedia([other, selected], other.id, selected.id, fallback, { requirePreferred })?.id, selected.id);
  assert.equal(pickDemoMedia([selected], selected.id, selected.id, fallback, { requirePreferred })?.id, selected.id);
});

test('video hero badges describe the displayed clip; image badges keep editorial copy', () => {
  const authored = ['Native audio', '30s', '1080p'];
  assert.deepEqual(
    getHeroMediaBadges({ ...fallback, hasAudio: true, durationSec: 24, aspectRatio: '16:9' }, authored, 'Audio enabled'),
    ['Audio enabled', '24s', '16:9'],
  );
  assert.deepEqual(
    getHeroMediaBadges({ ...fallback, hasAudio: false, durationSec: 5, aspectRatio: '9:16' }, authored, 'Audio enabled'),
    [null, '5s', '9:16'],
  );
  assert.deepEqual(getHeroMediaBadges({ ...fallback, videoUrl: null }, authored, 'Audio enabled'), authored);
});


test('a managed model selection keeps its first playable hero while unmanaged galleries prefer landscape', async () => {
  const {projectModelPageGallery}=await import('../frontend/server/model-gallery-projection');
  type Video=import('../frontend/server/videos-normalization').GalleryVideo;
  const cards=[card('portrait','9:16'),card('landscape','16:9')];
  const videos=cards.map(item=>({...item,engineId:'wan-3'})) as unknown as Video[];
  const gallery=await projectModelPageGallery({
    engine:{modelSlug:'wan-3',id:'wan-3'},examples:videos,managed:true,
    preferred:{hero:'landscape',demo:null},featuredIds:['landscape'],
    getPublicVideosByIds:async()=>new Map(videos.map(video=>[video.id,video])),
    toCard:video=>cards.find(item=>item.id===video.id)!,
  });
  assert.deepEqual(gallery.galleryVideos.map(item=>item.id),['portrait','landscape']);
  assert.equal(pickHeroMedia(gallery.galleryVideos,gallery.preferredIds.hero,fallback,{preserveOrder:gallery.managed}).id,'portrait');
  assert.equal(pickHeroMedia(cards,null,fallback).id,'landscape');
});
