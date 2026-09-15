const FALLBACK_POSTERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  seedream: {
    product: '/assets/model-examples/seedream/product.webp',
    character: '/assets/model-examples/seedream/character.webp',
    edit: '/assets/model-examples/seedream/edit.webp',
    batch: '/assets/model-examples/seedream/batch.webp',
  },
  'gpt-image-2': {
    cinema: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4ea3493c-6831-4f08-bedc-803506e0792f.png',
    portrait: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/1b8025e7-b426-4f8e-90aa-1d01ed992987.png',
  },
  'gpt-image-2-5-flare': {
    portrait: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/08029074-fdfb-4a63-8277-a4c23ebf38f1.png',
    cinema: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/eb9ab949-13ac-474a-b945-4f89d6effdd8.png',
    afterlight: 'https://media.maxvideoai.com/media-assets/301cc489-d689-477f-94c4-0b051deda0bc/6c1fb061-f94e-497f-8f33-7b85d3bceb78.png',
  },
  'gpt-image-2-5-sunburst': {
    cover: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4cb8db61-70d7-4bac-8c0d-8e9d0021f25d.png',
    architecture: 'https://media.maxvideoai.com/renders/images/301cc489-d689-477f-94c4-0b051deda0bc/4e0c6297-2c04-4d32-a75a-f82ba3337548.png',
  },
  'nano-banana': {
    campaign: '/assets/model-examples/nano-banana/campaign.webp',
    typography: '/assets/model-examples/nano-banana/typography.webp',
    reference: '/assets/model-examples/nano-banana/reference.webp',
    final: '/assets/model-examples/nano-banana/final.webp',
  },
  'nano-banana-2': {
    grounded: '/assets/model-examples/nano-banana-2/grounded.webp',
    edit: '/assets/model-examples/nano-banana-2/edit.webp',
    reference: '/assets/model-examples/nano-banana-2/reference.webp',
    wide: '/assets/model-examples/nano-banana-2/wide.webp',
  },
  'luma-uni-1': {
    product: '/assets/model-examples/luma-uni-1/product.webp',
    edit: '/assets/model-examples/luma-uni-1/edit.webp',
    reference: '/assets/model-examples/luma-uni-1/reference.webp',
    campaign: '/assets/model-examples/luma-uni-1/research.webp',
  },
  'luma-uni-1-max': {
    product: '/assets/model-examples/luma-uni-1-max/hero-product.webp',
    typography: '/assets/model-examples/luma-uni-1-max/typography.webp',
    edit: '/assets/model-examples/luma-uni-1-max/edit.webp',
    reference: '/assets/model-examples/luma-uni-1-max/reference.webp',
  },
  'nano-banana-pro': {
    campaign: '/assets/model-examples/nano-banana-pro/campaign.webp',
    typography: '/assets/model-examples/nano-banana-pro/typography.webp',
    reference: '/assets/model-examples/nano-banana-pro/reference.webp',
    final: '/assets/model-examples/nano-banana-pro/final.webp',
  },
};

export const MODEL_EXAMPLE_FALLBACK_POSTER_SLUGS: readonly string[] = Object.freeze(
  Object.keys(FALLBACK_POSTERS),
);

export function resolveModelExampleFallbackPosters(
  modelSlug: string,
  itemIds: readonly string[],
  fallbackImageUrl: string | null,
): ReadonlyMap<string, string> {
  return new Map(
    itemIds.map((id) => [id, FALLBACK_POSTERS[modelSlug]?.[id] ?? fallbackImageUrl ?? '']),
  );
}
