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

test('4K best-for shortlist ranks Veo standard first and Veo Fast third', () => {
  assert.ok(fourKEntry, '4K best-for entry should exist');
  assert.deepEqual(fourKEntry.topPicks?.slice(0, 3), ['veo-3-1', 'kling-3-4k', 'veo-3-1-fast']);
  assert.deepEqual(getPublishedRelatedComparisons(fourKEntry).slice(0, 3), [
    'kling-3-4k-vs-veo-3-1',
    'veo-3-1-vs-veo-3-1-fast',
    'ltx-2-3-pro-vs-veo-3-1',
  ]);
});

test('localized 4K best-for editorial content reflects the Veo 4K ranking', () => {
  for (const [locale, filePath] of Object.entries(localeContentPaths)) {
    const source = readFileSync(filePath, 'utf8');
    const veoIndex = source.indexOf('veo-3-1)');
    const klingIndex = source.indexOf('kling-3-4k)');
    const veoFastIndex = source.indexOf('veo-3-1-fast)');
    const ltxProIndex = source.indexOf('ltx-2-3-pro)');

    assert.ok(veoIndex > -1, `${locale} content should link to Veo 3.1`);
    assert.ok(klingIndex > -1, `${locale} content should link to Kling 3 4K`);
    assert.ok(veoFastIndex > -1, `${locale} content should link to Veo 3.1 Fast`);
    assert.ok(veoIndex < klingIndex, `${locale} content should place Veo 3.1 before Kling 3 4K`);
    assert.ok(klingIndex < veoFastIndex, `${locale} content should place Kling 3 4K before Veo Fast`);
    assert.ok(ltxProIndex === -1 || veoFastIndex < ltxProIndex, `${locale} content should keep LTX below the top three`);
  }
});

test('best-for example previews prefer exact Veo variant thumbnails before family fallback', () => {
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

  assert.match(
    pickModelSpecificPreviewThumb(createPick('veo-3-1-fast'), standardOnlyVideos) ?? '',
    /job_4db2339c-000a-4b81-a68c-9314dd7940b2/
  );
  assert.match(
    pickModelSpecificPreviewThumb(createPick('veo-3-1-lite'), standardOnlyVideos) ?? '',
    /0a6e2df3-0107-4ea7-8f70-6e03e406f39b/
  );
});
