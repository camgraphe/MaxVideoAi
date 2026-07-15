import type { SpecDetailsSection } from '@/components/marketing/SpecDetailsGrid.client';

export type SpecSection = SpecDetailsSection;
export type LocalizedFaqEntry = { question: string; answer: string };
export type QuickStartBlock = { title: string; subtitle?: string | null; steps: string[] };
export type HeroSpecIconKey = 'resolution' | 'duration' | 'textToVideo' | 'imageToVideo' | 'aspectRatio' | 'audio';
export type HeroSpecChip = { label: string; icon?: HeroSpecIconKey | null };
export type BestUseCaseIconKey =
  | 'ads'
  | 'ugc'
  | 'product'
  | 'storyboard'
  | 'type'
  | 'cinematic'
  | 'camera'
  | 'layers'
  | 'zap'
  | 'audio'
  | 'sparkles'
  | 'smartphone'
  | 'wand2'
  | 'arrowLeftRight'
  | 'layout'
  | 'pen'
  | 'repeat'
  | 'gamepad2'
  | 'image'
  | 'users'
  | 'repeat2'
  | 'volume2'
  | 'music'
  | 'mic'
  | 'scissors'
  | 'wind'
  | 'coins';
export type BestUseCaseItem = { title: string; icon: BestUseCaseIconKey; chips?: string[]; href?: string | null };
export type RelatedItem = {
  brand: string;
  title: string;
  description: string;
  modelSlug?: string | null;
  ctaLabel?: string | null;
  href?: string | null;
};
export type KeySpecKey =
  | 'pricePerImage'
  | 'pricePerSecond'
  | 'releaseDate'
  | 'textToImage'
  | 'imageToImage'
  | 'textToVideo'
  | 'imageToVideo'
  | 'videoToVideo'
  | 'firstLastFrame'
  | 'referenceImageStyle'
  | 'referenceVideo'
  | 'maxResolution'
  | 'maxDuration'
  | 'aspectRatios'
  | 'fpsOptions'
  | 'outputFormats'
  | 'audioOutput'
  | 'nativeAudioGeneration'
  | 'lipSync'
  | 'cameraMotionControls'
  | 'watermark';
export type KeySpecRow = { id: string; key: KeySpecKey; label: string; value: string; valueLines?: string[] };
export type KeySpecValues = Record<KeySpecKey, string>;

export type SoraCopy = {
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroSupportLine: string | null;
  heroBadge: string | null;
  heroSpecChips: HeroSpecChip[];
  heroTrustLine: string | null;
  heroDesc1: string | null;
  heroDesc2: string | null;
  primaryCta: string | null;
  primaryCtaHref: string | null;
  secondaryCta: string | null;
  secondaryCtaHref: string | null;
  whyTitle: string | null;
  heroHighlights: string[];
  bestUseCasesTitle: string | null;
  bestUseCaseItems: BestUseCaseItem[];
  bestUseCases: string[];
  whatTitle: string | null;
  whatIntro1: string | null;
  whatIntro2: string | null;
  whatFlowTitle: string | null;
  whatFlowSteps: string[];
  quickStartTitle: string | null;
  quickStartBlocks: QuickStartBlock[];
  howToLatamTitle: string | null;
  howToLatamSteps: string[];
  specTitle: string | null;
  specNote: string | null;
  specSections: SpecSection[];
  specValueProp: string | null;
  quickPricingTitle: string | null;
  quickPricingItems: string[];
  hideQuickPricing: boolean;
  showPricePerSecondInSpecs: boolean;
  hidePricingSection: boolean;
  microCta: string | null;
  galleryTitle: string | null;
  galleryIntro: string | null;
  gallerySceneCta: string | null;
  galleryAllCta: string | null;
  recreateLabel: string | null;
  imageTitle: string | null;
  imageIntro: string | null;
  imageFlow: string[];
  imageWhy: string[];
  multishotTitle: string | null;
  multishotIntro1: string | null;
  multishotIntro2: string | null;
  multishotTips: string[];
  tipsTitle: string | null;
  tipsIntro: string | null;
  strengths: string[];
  boundaries: string[];
  troubleshootingTitle: string | null;
  troubleshootingItems: string[];
  tipsFooter: string | null;
  safetyTitle: string | null;
  safetyRules: string[];
  safetyInterpretation: string[];
  safetyNote: string | null;
  comparisonTitle: string | null;
  comparisonPoints: string[];
  comparisonCta: string | null;
  relatedCtaSora2: string | null;
  relatedCtaSora2Pro: string | null;
  relatedTitle: string | null;
  relatedSubtitle: string | null;
  relatedItems: RelatedItem[];
  finalPara1: string | null;
  finalPara2: string | null;
  finalButton: string | null;
  faqTitle: string | null;
  faqs: LocalizedFaqEntry[];
};
