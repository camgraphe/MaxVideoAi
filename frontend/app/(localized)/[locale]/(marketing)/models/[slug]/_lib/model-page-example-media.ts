const FALLBACK_POSTERS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  seedream: {
    product: '/assets/model-examples/seedream/product.webp',
    character: '/assets/model-examples/seedream/character.webp',
    edit: '/assets/model-examples/seedream/edit.webp',
    batch: '/assets/model-examples/seedream/batch.webp',
  },
  'gpt-image-2': {
    product: '/assets/model-examples/gpt-image-2/product.webp',
    typography: '/assets/model-examples/gpt-image-2/typography.webp',
    ui: '/assets/model-examples/gpt-image-2/ui.webp',
    edit: '/assets/model-examples/gpt-image-2/edit.webp',
    mask: '/assets/model-examples/gpt-image-2/mask.webp',
    final: '/assets/model-examples/gpt-image-2/final.webp',
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
