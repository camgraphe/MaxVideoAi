import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { resolveModelExampleFallbackPosters } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts';
import { pickHeroMedia, type FeaturedMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts';

const GPT_IMAGE_MEDIA = {
  'gpt-image-2': {
    hero: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4ea3493c-6831-4f08-bedc-803506e0792f.png',
    items: {
      cinema: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4ea3493c-6831-4f08-bedc-803506e0792f.png',
      portrait: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/1b8025e7-b426-4f8e-90aa-1d01ed992987.png',
    },
  },
  'gpt-image-2-5-flare': {
    hero: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/eb9ab949-13ac-474a-b945-4f89d6effdd8.png',
    items: {
      portrait: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/08029074-fdfb-4a63-8277-a4c23ebf38f1.png',
      cinema: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/eb9ab949-13ac-474a-b945-4f89d6effdd8.png',
      afterlight: 'https://media.maxvideoai.com/media-assets/301cc489-d689-477f-94c4-0b051deda0bc/6c1fb061-f94e-497f-8f33-7b85d3bceb78.png',
    },
  },
  'gpt-image-2-5-sunburst': {
    hero: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4e0c6297-2c04-4d32-a75a-f82ba3337548.png',
    items: {
      cover: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4cb8db61-70d7-4bac-8c0d-8e9d0021f25d.png',
      architecture: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4e0c6297-2c04-4d32-a75a-f82ba3337548.png',
    },
  },
} as const;

for (const [slug, expected] of Object.entries(GPT_IMAGE_MEDIA)) {
  test(`${slug} uses its own reviewed editorial hero and gallery`, () => {
    const entry = listFalEngines().find((candidate) => candidate.id === slug);
    assert.ok(entry);
    assert.equal(entry.media?.imagePath, expected.hero);
    assert.equal(entry.media?.videoUrl, expected.hero);

    const posters = resolveModelExampleFallbackPosters(slug, Object.keys(expected.items), null);
    assert.deepEqual(Object.fromEntries(posters), expected.items);
  });

  for (const locale of ['en', 'fr', 'es']) {
    test(`${slug} ${locale} content exposes only the reviewed gallery items`, () => {
      const content = JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
      assert.equal(content.seo.image, expected.hero);
      assert.deepEqual(content.examples.fallbackItems.map((item: { id: string }) => item.id), Object.keys(expected.items));
    });
  }
}

test('Sunburst no longer publishes the rejected LUMEN artwork', () => {
  const sources = [
    readFileSync('frontend/src/config/fal-engines/gpt-image-2-5.ts', 'utf8'),
    readFileSync('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-example-media.ts', 'utf8'),
    ...['en', 'fr', 'es'].map((locale) => readFileSync(`content/models/${locale}/gpt-image-2-5-sunburst.json`, 'utf8')),
  ].join('\n');
  assert.doesNotMatch(sources, /61ed3009-b76c-4a5b-acf4-b332563f5e99|LUMEN/i);
});

test('image model pages keep their curated configured hero ahead of playlist imagery', () => {
  const configuredHero: FeaturedMedia = {
    id: 'configured-image-hero',
    prompt: 'Curated image hero',
    videoUrl: null,
    posterUrl: GPT_IMAGE_MEDIA['gpt-image-2'].hero,
  };
  const playlistCard = {
    id: 'older-playlist-image',
    href: '/app/image?job=older-playlist-image',
    engineLabel: 'GPT Image 2',
    prompt: 'Older playlist image',
    optimizedPosterUrl: 'https://example.com/older.webp',
    rawPosterUrl: 'https://example.com/older.png',
    videoUrl: 'https://example.com/older.png',
  };

  assert.equal(pickHeroMedia([playlistCard], null, configuredHero), configuredHero);
});

for (const [slug, hero] of [
  ['luma-uni-1', '/assets/model-examples/luma-uni-1/product.webp'],
  ['luma-uni-1-max', '/assets/model-examples/luma-uni-1-max/hero-product.webp'],
] as const) {
  test(`${slug} promotes its existing local example into the hero`, () => {
    const entry = listFalEngines().find((candidate) => candidate.id === slug);
    assert.ok(entry);
    assert.equal(entry.media?.imagePath, hero);
    assert.equal(entry.media?.videoUrl, hero);
    for (const locale of ['en', 'fr', 'es']) {
      const content = JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
      assert.equal(content.seo.image, hero);
    }
  });
}
