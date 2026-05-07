import type { LocalizedLinkHref } from '@/i18n/navigation';

export type AnalyticsProps = {
  'data-analytics-event'?: string;
  'data-analytics-cta-name'?: string;
  'data-analytics-cta-location'?: string;
  'data-analytics-target-family'?: string;
  'data-analytics-tool-name'?: string;
  'data-analytics-tool-surface'?: string;
};

export type HomeCta = {
  label: string;
  href: LocalizedLinkHref;
  analytics?: AnalyticsProps;
};

export type HomeHeroContent = {
  eyebrow: string;
  badgeChips: string[];
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  examplesCta: string;
  trustBadges: string[];
  valueCards: Array<{
    title: string;
    body: string;
  }>;
  mockup: {
    promptLabel: string;
    prompt: string;
    shotTypeLabel: string;
    shotTypes: string[];
    engineLabel: string;
    engineRecommendations: Array<{
      engineId: string;
      name: string;
      provider: string;
      bestFor: string;
      fallbackPrice: string;
      price?: string;
      modeLabel?: string;
      rateLabel?: string;
      examplesHref?: LocalizedLinkHref;
      modelHref?: LocalizedLinkHref;
      examplesLabel?: string;
      modelLabel?: string;
      selected?: boolean;
      scores: Array<{ label: string; value: number }>;
      tags: string[];
    }>;
    quoteLabel: string;
    quoteValue: string;
    quoteMeta: string;
    outputLabel: string;
    queueLabel: string;
    queueItems: string[];
    generateCta: string;
    refundNote: string;
    playLabel: string;
    pauseLabel: string;
  };
};

export type ProofStat = {
  id: string;
  value: string;
  label: string;
  href?: LocalizedLinkHref;
};

export type BestForTopPick = {
  slug: string;
  label: string;
  brandId?: string;
  provider?: string;
};

export type ShotTypeCard = {
  id: string;
  slug: string;
  title: string;
  body: string;
  cta: string;
  href: LocalizedLinkHref;
  tier: number;
  topPicks: BestForTopPick[];
};

export type HomeExampleCard = {
  id: string;
  title: string;
  engineId?: string;
  engine: string;
  mode: string;
  duration: string;
  price?: string | null;
  useCase: string;
  imageSrc: string;
  videoSrc?: string | null;
  imageAlt: string;
  href: LocalizedLinkHref;
  modelHref?: LocalizedLinkHref;
  cloneHref?: LocalizedLinkHref;
  ctaLabel: string;
  examplesCtaVisible?: boolean;
  modelCtaLabel?: string;
  cloneLabel?: string;
};

export type ComparisonCard = {
  id: string;
  title: string;
  body: string;
  badges: string[];
  cta: string;
  href: LocalizedLinkHref;
  imageSrc?: string;
  imageAlt?: string;
  media?: Array<{
    imageSrc: string;
    imageAlt: string;
    label?: string;
  }>;
};

export type WorkflowStep = {
  title: string;
  body: string;
  toolLabel: string;
  href: LocalizedLinkHref;
};

export type ToolIconKey =
  | 'text'
  | 'image'
  | 'video'
  | 'generateImage'
  | 'character'
  | 'angle'
  | 'extend'
  | 'retake'
  | 'audio'
  | 'compare';

export type ToolCard = {
  id: string;
  title: string;
  body: string;
  shortBody?: string;
  href: LocalizedLinkHref;
  icon: ToolIconKey;
};

export type TrustCard = {
  title: string;
  body: string;
};

export type ProviderItem = {
  provider: string;
  model: string;
  href?: LocalizedLinkHref;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type SectionCopy = {
  title: string;
  subtitle: string;
  eyebrow?: string;
  cta?: string;
  primaryCta?: string;
  secondaryCta?: string;
  scorecardTitle?: string;
  scorecardSubtitle?: string;
  scorecardLeftLabel?: string;
  scorecardRightLabel?: string;
  scorecardCriteriaLabel?: string;
  scorecardRows?: Array<{ label: string; left: number; right: number }>;
  featureCards?: Array<{ title: string; body: string }>;
  modelsCta?: string;
  libraryTitle?: string;
  libraryBody?: string;
  providerLabel?: string;
  hubCtaTitle?: string;
  hubCtaBody?: string;
  guideLabel?: string;
  topPicksLabel?: string;
  moreGuidesTitle?: string;
  supportingText?: string;
  modelsLink?: string;
  examplesLink?: string;
  compareLink?: string;
};

export type WorkflowSeoSummaryCopy = {
  heroParagraph?: string;
  heroPoints?: string[];
  definition?: {
    title?: string;
    body?: string;
  };
  generateWays?: {
    title?: string;
    items?: Array<{
      title: string;
      body: string;
    }>;
  };
};
