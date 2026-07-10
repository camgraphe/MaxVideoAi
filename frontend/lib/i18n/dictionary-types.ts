import type { PricingScenario } from '@/lib/pricing-scenarios';
import type { EngineAvailability } from '@/types/engines';

export type Locale = 'en' | 'fr';

export type Dictionary = {
  nav: {
    brand: string;
    links: Array<{ key: string; href: string }>;
    login: string;
    cta: string;
    linkLabels: Record<string, string>;
  };
  footer: {
    links: Array<{ label: string; href: string }>;
    brandNote: string;
    languageLabel: string;
    languages: Array<{ locale: Locale; label: string }>;
  };
  home: {
    badges: string[];
    hero: {
      title: string;
      subtitle: string;
      primaryCta: string;
      secondaryCta: string;
    };
    worksWith: {
      label: string;
      brands?: string[];
      caption: string;
      availabilityNotice: string;
    };
    heroScreenshot: {
      title: string;
      body: string;
      alt: string;
    };
    proofTabs: Array<{ id: string; label: string; heading: string; body: string }>;
    whyCards: Array<{ title: string; body: string }>;
    ways: Array<{ title: string; description: string; bullets: string[] }>;
    waysSection: { title: string; subtitle: string; eyebrow?: string };
    examplesCallout?: {
      eyebrow?: string;
      title: string;
      subtitle?: string;
      cta: string;
    };
    gallery: {
      title: string;
      subtitle: string;
      caption: string;
      hoverLabel: string;
      items: Array<{
        id: string;
        label: string;
        description: string;
        alt: string;
        meta: {
          slug: string;
          pricing: { engineId: string; durationSec: number; resolution: string; memberTier?: string };
        };
        media?: {
          videoSrc: string;
          posterSrc?: string;
          hasAudio?: boolean;
        };
      }>;
    };
    pricing: {
      badge: string;
      title: string;
      body: string;
      link: string;
    };
    trust: {
      badge: string;
      points: string[];
    };
    priceChipSuffix: string;
    priceChipPrefix?: string;
  };
  pricing: {
    hero: {
      title: string;
      subtitle: string;
    };
    estimator: {
      title: string;
      subtitle: string;
      walletLink: string;
      walletLinkCta: string;
      chargedNote: string;
      fields: {
        engine: string;
        resolution: string;
        duration: string;
        memberStatus: string;
      };
      estimateLabels: {
        heading: string;
        base: string;
        discount: string;
        memberChipPrefix: string;
      };
      descriptions: Record<string, string>;
      engineRateLabel?: string;
      durationLabel?: string;
      resolutionLabel?: string;
    };
    wallet: {
      title: string;
      description: string;
      points: string[];
      balanceLabel?: string;
      balanceHelper?: string;
      autoTopUpLabel?: string;
      autoTopUpHint?: string;
      addLabel?: string;
    };
    teams: {
      title: string;
      description: string;
      comingSoonNote?: string;
      points: string[];
    };
    member: {
      title: string;
      subtitle: string;
      tiers: Array<{ name: string; requirement: string; benefit: string }>;
      chipBase: string;
      tooltip: string;
    };
    refunds: {
      title: string;
      points: string[];
    };
    faq: {
      title: string;
      entries: Array<{ question: string; answer: string }>;
    };
    priceChipSuffix: string;
    priceChipPrefix?: string;
  };
  calculator: {
    hero: {
      title: string;
      subtitle: string;
    };
    lite: {
      title: string;
      subtitle: string;
      footer: string;
      footerLinkText: string;
    };
  };
  workflows: {
    hero: {
      title: string;
      subtitle: string;
    };
    express: {
      badge: string;
      title: string;
      features: string[];
    };
    workflows: {
      badge: string;
      title: string;
      features: string[];
    };
  };
  models: {
    hero: {
      title: string;
      subtitle: string;
    };
    availabilityLabels: Record<EngineAvailability, string>;
    meta: Record<string, { displayName: string; description: string; priceBefore: string; versionLabel?: string }>;
    note: string;
  };
  examples: {
    hero: {
      title: string;
      subtitle: string;
    };
    items: Array<{
      title: string;
      engine: string;
      description: string;
      alt: string;
      meta?: {
        slug: string;
        pricing: PricingScenario;
      };
      media?: {
        videoSrc: string;
        posterSrc?: string;
        aspectRatio?: '16:9' | '9:16' | '1:1';
      };
    }>;
    cta: string;
  };
  docs: {
    hero: {
      title: string;
      subtitle: string;
    };
    sections: Array<{ title: string; items: Array<string | { type: 'link'; before: string; terms: string; and: string; privacy: string; after: string }> }>;
    empty: string;
    libraryHeading?: string;
  };
  blog: {
    hero: {
      title: string;
      subtitle: string;
    };
    empty: string;
    cta?: string;
  };
  about: {
    hero: {
      title: string;
      subtitle: string;
    };
    paragraphs: string[];
    note: string;
  };
  contact: {
    hero: {
      title: string;
      subtitle: string;
    };
    form: {
      name: string;
      email: string;
      topic: string;
      selectPlaceholder: string;
      topics: Array<{ value: string; label: string }>;
      message: string;
      submit: string;
      alt: string;
    };
  };
  legal: {
    terms: {
      title: string;
      intro: string;
      sections: Array<{ heading: string; body: string }>;
    };
    privacy: {
      title: string;
      intro: string;
      sections: Array<{ heading: string; body: string }>;
    };
  };
  changelog: {
    hero: {
      title: string;
      subtitle: string;
    };
    entries: Array<{ date: string; title: string; body: string }>;
  };
  status: {
    hero: { title: string; subtitle: string };
    currentNotice: {
      title: string;
      activeLabel: string;
      clearLabel: string;
      clearBody: string;
    };
    affected: { title: string; body: string };
    support: { title: string; prefix: string; suffix: string };
  };
  systemMessages: {
    refundInitiated: string;
    partialRefund: string;
    paymentRetried: string;
  };
};
