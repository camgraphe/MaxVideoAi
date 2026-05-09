import type {
  FaqItem,
  ProviderItem,
  ToolCard,
  TrustCard,
  WorkflowStep,
} from '@/components/marketing/home/HomeRedesignSections';
import type { Mode } from '@/types/engines';

type ProofConfig = {
  items: Array<{ id: string; label: string }>;
};

export const HOMEPAGE_EXAMPLE_FAMILIES = ['seedance', 'kling', 'ltx', 'veo', 'wan', 'happy-horse'] as const;
export type HomepageExampleFamily = (typeof HOMEPAGE_EXAMPLE_FAMILIES)[number];

export type FallbackExampleCard = {
  id: string;
  title: string;
  engine: string;
  engineId: string;
  modelSlug?: string;
  mode: string;
  duration: string;
  price?: string;
  useCase: string;
  cta: string;
  cloneCta?: string;
  imageSrc: string;
  imageAlt: string;
  examplesSlug?: HomepageExampleFamily;
  showExamplesCta?: boolean;
  modelCta?: string;
};

export type ComparisonConfig = {
  id: string;
  slug: string;
  title: string;
  body: string;
  badges: string[];
  imageSrc?: string;
  imageAlt?: string;
};

export type ComparisonMediaItem = {
  imageSrc: string;
  imageAlt: string;
  label?: string;
};

export type BestForPageConfig = {
  slug: string;
  title: string;
  description?: string;
  tier: number;
  topPicks?: string[];
};

export type EngineCatalogEntry = {
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string;
};

export type BestForCardCopy = {
  slug: string;
  title: string;
  body: string;
  cta: string;
};

export type ProviderConfig = ProviderItem & {
  providerKey: string;
};

export type RedesignContent = {
  hero: import('@/components/marketing/home/HomeRedesignSections').HomeHeroContent;
  proof: ProofConfig;
  shotTypes: {
    title: string;
    subtitle: string;
    eyebrow?: string;
    cta?: string;
    hubCtaTitle?: string;
    hubCtaBody?: string;
    guideLabel?: string;
    topPicksLabel?: string;
    moreGuidesTitle?: string;
    cards: BestForCardCopy[];
  };
  examples: {
    title: string;
    subtitle: string;
    cta: string;
    modelsCta?: string;
    compareLink?: string;
    libraryTitle?: string;
    libraryBody?: string;
    providerLabel?: string;
    viewPrompt: string;
    fallbackCards: FallbackExampleCard[];
  };
  comparisons: {
    title: string;
    subtitle: string;
    cta: string;
    cards: ComparisonConfig[];
  };
  workflow: {
    title: string;
    subtitle: string;
    steps: WorkflowStep[];
  };
  toolbox: {
    title: string;
    subtitle: string;
    primaryCta?: string;
    secondaryCta?: string;
    cards: ToolCard[];
  };
  pricingTrust: {
    title: string;
    subtitle: string;
    cta: string;
    cards: TrustCard[];
  };
  providers: {
    title: string;
    subtitle: string;
    cta: string;
    items: ProviderConfig[];
  };
  faq: {
    title: string;
    subtitle: string;
    items: FaqItem[];
  };
  modeLabels: Partial<Record<Mode | 'unknown', string>>;
};

export type EngineStats = {
  total: number;
  providers: number;
  textToVideo: number;
  imageToVideo: number;
  videoToVideo: number;
  audio: number;
  fourK: number;
  extend: number;
  retake: number;
  audioToVideo: number;
};
