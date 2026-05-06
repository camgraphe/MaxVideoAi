export const DEFAULT_WORKSPACE_COPY = {
  errors: {
    loadEngines: 'Failed to load engines.',
    noEngines: 'No engines available.',
  },
  gallery: {
    empty: 'Launch a generation to populate your gallery. Variants for each run will appear here.',
  },
  wallet: {
    insufficient: 'Insufficient wallet balance. Please add funds to continue generating.',
    insufficientWithAmount: 'Insufficient wallet balance. Add at least {amount} to continue generating.',
  },
  topUp: {
    title: 'Add credits',
    presetsLabel: 'Add credits',
    otherAmountLabel: 'Other amount',
    minLabel: 'Min {amount}',
    close: 'Close',
    maybeLater: 'Maybe later',
    submit: 'Add funds',
    submitting: 'Starting top-up…',
  },
  authGate: {
    title: 'Create an account to render',
    body: 'You can explore the full workspace with starter renders, but launching a real render requires an account.',
    primary: 'Create account',
    secondary: 'Sign in',
    close: 'Maybe later',
    uploadLocked: 'Sign in to upload',
  },
  assetLibrary: {
    title: 'Select asset',
    searchPlaceholder: 'Search assets…',
    import: 'Import',
    importing: 'Importing…',
    importFailed: 'Import failed. Please try again.',
    refresh: 'Refresh',
    close: 'Close',
    fieldFallback: 'Asset',
    sourcesTitle: 'Library',
    toolsTitle: 'Create or transform',
    toolsDescription: 'Open another workspace to prepare a better source before importing it here.',
    emptySearch: 'No assets match this search.',
    empty: 'No saved images yet. Upload a reference image to see it here.',
    emptyUploads: 'No uploaded images yet. Upload a reference image to see it here.',
    emptyGenerated: 'No generated images saved yet. Save a generated image to see it here.',
    emptyCharacter: 'No character assets saved yet. Generate one in Character Builder first.',
    emptyAngle: 'No angle assets saved yet. Generate one in the Angle tool first.',
    emptyUpscale: 'No upscale assets saved yet. Save an upscale result first.',
    tabs: {
      all: 'All',
      upload: 'Uploaded',
      generated: 'Generated',
      character: 'Character',
      angle: 'Angle',
      upscale: 'Upscale',
    },
    shortcuts: {
      createImage: 'Create image',
      changeAngle: 'Change angle',
      characterBuilder: 'Character builder',
      upscale: 'Upscale',
    },
  },
} as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeCopy<T extends Record<string, unknown>>(defaults: T, overrides?: Partial<T> | null): T {
  if (!isPlainRecord(overrides)) return defaults;
  const next: Record<string, unknown> = { ...defaults };
  Object.entries(overrides).forEach(([key, overrideValue]) => {
    const defaultValue = next[key];
    if (isPlainRecord(defaultValue) && isPlainRecord(overrideValue)) {
      next[key] = mergeCopy(defaultValue, overrideValue);
      return;
    }
    if (overrideValue !== undefined) {
      next[key] = overrideValue;
    }
  });
  return next as T;
}
