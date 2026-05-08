export const DEFAULT_COMPOSER_COPY = {
  title: 'Composer',
  subtitle: 'Enhance prompt • Non-destructive reruns',
  badges: {
    payg: 'Pay-as-you-go',
    priceBefore: 'Price-before',
    alwaysCurrent: 'Always-current',
  },
  priceLabel: 'This render: {amount}',
  memberLabel: 'Member price — You save {percent}%',
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
