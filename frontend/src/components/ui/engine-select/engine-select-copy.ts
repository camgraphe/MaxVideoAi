import { DEFAULT_ENGINE_GUIDE } from '@/lib/engine-guides';

export const DEFAULT_ENGINE_SELECT_COPY = {
  avgDuration: 'Avg {value}',
  choose: 'Choose engine',
  variant: 'Variant',
  families: 'Families',
  models: 'Models',
  score: 'Score',
  searchPlaceholder: 'Search engines',
  browse: 'Browse engines...',
  browseCompact: 'Browse engines',
  inputMode: 'Input mode',
  unsupportedMode: 'Not supported by this engine',
  modal: {
    close: 'Close',
    title: 'Choose the right engine for your shot',
    subtitle:
      'Each model has its own strengths - some are fast, others cinematic or experimental. See what fits your project, then generate with confidence.',
    pricingLink: 'How pricing works',
    searchPlaceholder: 'Search by engine, provider, or capability',
    modeAll: 'Mode: All',
    modeValue: 'Mode: {value}',
    resolutionAll: 'Resolution: All',
    legacyToggleLabel: 'Legacy models',
    viewModel: 'View model page',
    viewExamples: 'View examples',
    empty:
      'No engines match your filters yet. Adjust the filters or clear the search to explore the full catalogue.',
    disclaimer: 'Logos are used for descriptive purposes only. Trademarks belong to their respective owners.',
    descriptionFallback:
      'Versatile engine ready for price-before-you-generate workflows. Review specs and run with confidence.',
  },
  guides: DEFAULT_ENGINE_GUIDE,
} as const;

export type EngineSelectCopy = typeof DEFAULT_ENGINE_SELECT_COPY;

export function mergeEngineSelectCopy(rawCopy: Partial<EngineSelectCopy> | null | undefined): EngineSelectCopy {
  return {
    ...DEFAULT_ENGINE_SELECT_COPY,
    ...(rawCopy ?? {}),
    modal: {
      ...DEFAULT_ENGINE_SELECT_COPY.modal,
      ...(rawCopy?.modal ?? {}),
    },
    guides: {
      ...DEFAULT_ENGINE_SELECT_COPY.guides,
      ...(rawCopy?.guides ?? {}),
    },
  } as EngineSelectCopy;
}
