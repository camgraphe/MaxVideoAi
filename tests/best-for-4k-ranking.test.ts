import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { BEST_FOR_PAGES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts';
import type { RankedPick } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts';
import { pickModelSpecificPreviewThumb } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-previews.ts';
import { getPublishedRelatedComparisons } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-related.ts';

const root = process.cwd();
const fourKEntry = BEST_FOR_PAGES.find((entry) => entry.slug === '4k-video');
const localeContentPaths = {
  en: join(root, 'content/en/best-for/4k-video.mdx'),
  fr: join(root, 'content/fr/best-for/4k-video.mdx'),
  es: join(root, 'content/es/best-for/4k-video.mdx'),
} as const;

function createPick(slug: string): RankedPick {
  return {
    slug,
    rank: 1,
    criterion: 'Preview',
    score: 10,
    accent: 'from-brand',
    reason: 'Test pick',
    bullets: [],
  };
}

test('4K selection leads with the reference-capable Omni variant and keeps distinct workflows', () => {
  assert.ok(fourKEntry);
  assert.deepEqual(fourKEntry.topPicks, ['kling-o3-4k', 'minimax-h3', 'veo-3-1', 'gemini-omni-flash', 'seedance-2-0']);
  assert.ok(getPublishedRelatedComparisons(fourKEntry, 'en').includes('minimax-h3-vs-veo-3-1'));
  for (const [locale, filePath] of Object.entries(localeContentPaths)) {
    const source = readFileSync(filePath, 'utf8');
    let previous = -1;
    for (const model of fourKEntry.topPicks!) {
      const index = source.indexOf(model + ')');
      assert.ok(index > previous, locale + '/' + model);
      previous = index;
    }
  }
});

test('best-for example previews use exact Veo variant thumbnails', () => {
  const veoVideos = [
    {
      engineId: 'veo-3-1',
      thumbUrl: 'standard.jpg',
      videoUrl: 'standard.mp4',
    },
    {
      engineId: 'veo-3-1-lite',
      thumbUrl: 'lite.jpg',
      videoUrl: 'lite.mp4',
    },
    {
      engineId: 'veo-3-1-fast',
      thumbUrl: 'fast.jpg',
      videoUrl: 'fast.mp4',
    },
  ];

  assert.equal(pickModelSpecificPreviewThumb(createPick('veo-3-1'), veoVideos), 'standard.jpg');
  assert.equal(pickModelSpecificPreviewThumb(createPick('veo-3-1-fast'), veoVideos), 'fast.jpg');
  assert.equal(pickModelSpecificPreviewThumb(createPick('veo-3-1-lite'), veoVideos), 'lite.jpg');
});

test('best-for example previews do not fall back to standard Veo art for known Veo variants', () => {
  const standardOnlyVideos = [
    {
      engineId: 'veo-3-1',
      thumbUrl: 'standard.jpg',
      videoUrl: 'standard.mp4',
    },
  ];

  assert.equal(pickModelSpecificPreviewThumb(createPick('veo-3-1-fast'), standardOnlyVideos), null);
  assert.equal(pickModelSpecificPreviewThumb(createPick('veo-3-1-lite'), standardOnlyVideos), null);
});
