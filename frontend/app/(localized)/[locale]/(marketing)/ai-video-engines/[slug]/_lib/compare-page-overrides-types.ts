export type ComparePageOverride = {
  meta?: {
    title?: string;
    description?: string;
    titleBranding?: 'auto' | 'none';
  };
  heroIntro?: string;
  decisionSummary?: string;
  decisionLinks?: Array<{ href: string; label: string }>;
  pricingCreditLink?: {
    href: '/pay-as-you-go-ai-video-generator';
    label: string;
  };
  quickVerdict?: {
    title: string;
    body: string;
  };
  topCards?: Array<{
    title: string;
    body: string;
  }>;
  primaryLinksTitle?: string;
  primaryLinks?: Array<{
    href: string;
    label: string;
  }>;
  faq?: {
    title?: string;
    subtitle?: string;
    items: Array<{
      question: string;
      answer: string | string[];
    }>;
  };
};

export type ComparePageContentDocument = {
  slug: string;
  en: ComparePageOverride;
  fr: ComparePageOverride;
  es: ComparePageOverride;
};
