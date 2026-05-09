export {
  BEST_USE_CASE_ICON_MAP,
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  GENERIC_TRUST_LINE,
  HERO_AUTOPLAY_DELAY_MS,
  HERO_BG,
  HERO_SPEC_ICON_MAP,
  PRICE_AUDIO_LABELS,
  SECTION_BG_A,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  TIPS_CARD_LABELS,
} from './model-page-specs-constants';

export type {
  BestUseCaseIconKey,
  BestUseCaseItem,
  HeroSpecChip,
  HeroSpecIconKey,
  KeySpecKey,
  KeySpecRow,
  KeySpecValues,
  LocalizedFaqEntry,
  PromptingTab,
  PromptingTabId,
  QuickStartBlock,
  RelatedItem,
  SoraCopy,
  SpecSection,
} from './model-page-specs-types';

export {
  buildSpecValues,
  formatAspectRatios,
  formatDuration,
  formatFps,
  formatImageResolutions,
  formatMaxResolution,
  formatOutputFormats,
  formatPricePerImage,
  formatPricePerSecond,
  getPricePerImageCents,
  getPricePerSecondCents,
  resolveFirstLastSupport,
  resolveKeySpecValue,
  resolveModeSupported,
  resolveReferenceImageSupport,
  resolveReferenceVideoSupport,
  resolveStatus,
  resolveVideoToVideoSupport,
} from './model-page-spec-values';

export {
  isPending,
  isSupported,
  isUnsupported,
  localizeSpecStatus,
  resolveSpecStatusLabels,
} from './model-page-spec-status';

export {
  buildAutoHeroSpecChips,
  buildEyebrow,
  buildSupportLine,
  formatHeroLimitChip,
  joinUseCaseList,
  normalizeHeroSubtitle,
  normalizeHeroTitle,
  normalizeMaxResolution,
  resolveHeroLimitsLine,
} from './model-page-hero-specs';

export {
  buildAutoSpecSections,
  buildDefaultSpecTitle,
  inferBestUseCaseIcon,
  normalizeBestUseCaseItems,
  normalizeChips,
  normalizeSecondaryCta,
  normalizeSpecNote,
  normalizeSpecTitle,
  resolveAudioPricingLabels,
  resolveCompareCopy,
  resolveSectionLabels,
  resolveSpecRowDefs,
  resolveSpecRowLabel,
} from './model-page-spec-sections';
