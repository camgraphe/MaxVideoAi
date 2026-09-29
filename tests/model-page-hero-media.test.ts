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
