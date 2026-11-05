export const DEFAULT_COMPOSER_COPY = {
  title: 'Composer',
  subtitle: 'Enhance prompt • Non-destructive reruns',
  badges: {
    payg: 'Pay-as-you-go',
    priceBefore: 'Price-before',
    alwaysCurrent: 'Always-current',
  },
  priceLabel: 'This render: {amount}',
  labels: {
    required: 'Required',
    optional: 'Optional',
  },
  prompt: {
    placeholder: 'Describe the scene…',
    placeholderWithImage: 'Describe how the image should move / transform…',
  },
  negativePrompt: {
    placeholder: 'Elements to avoid…',
    requiredHint: 'Required',
  },
  assetSlots: {
    imageCtaLabel: 'Generate reference images',
    imageCtaHref: '/app/image',
    referenceWarning: '',
  },
  shortcuts: {
    generate: 'Cmd+Enter • Generate',
    price: 'G • Price-before',
    seed: 'S • Lock seed',
  },
  iterationsLabel: '×{count}',
  button: {
    idle: 'Generate',
    loading: 'Checking price…',
  },
} as const;

export type ComposerCopy = typeof DEFAULT_COMPOSER_COPY;

/** Resolve partial translations without losing nested default labels. */
export function resolveComposerCopy(localized?: Partial<ComposerCopy>): ComposerCopy {
  if (!localized) return DEFAULT_COMPOSER_COPY;
  return {
    ...DEFAULT_COMPOSER_COPY,
    ...localized,
    badges: {
      ...DEFAULT_COMPOSER_COPY.badges,
      ...(localized.badges ?? {}),
    },
    prompt: {
      ...DEFAULT_COMPOSER_COPY.prompt,
      ...(localized.prompt ?? {}),
    },
    negativePrompt: {
      ...DEFAULT_COMPOSER_COPY.negativePrompt,
      ...(localized.negativePrompt ?? {}),
    },
    shortcuts: {
      ...DEFAULT_COMPOSER_COPY.shortcuts,
      ...(localized.shortcuts ?? {}),
    },
    labels: {
      ...DEFAULT_COMPOSER_COPY.labels,
      ...(localized.labels ?? {}),
    },
    button: {
      ...DEFAULT_COMPOSER_COPY.button,
      ...(localized.button ?? {}),
    },
    assetSlots: {
      ...DEFAULT_COMPOSER_COPY.assetSlots,
      ...(localized.assetSlots ?? {}),
    },
  };
}
