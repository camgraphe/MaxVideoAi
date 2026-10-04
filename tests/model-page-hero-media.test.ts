import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExampleGalleryVideo } from '../frontend/components/examples/ExamplesGalleryGrid.tsx';
import {
  getHeroMediaBadges,
  pickHeroMedia,
  type FeaturedMedia,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';

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
