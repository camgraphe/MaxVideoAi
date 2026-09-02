import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';

import { buildDecisionPricingScenarios, type ModelDecisionPricingScenario } from './model-page-decision-pricing';
import { parseModelDecisionContent } from './model-page-decision-content';
import { getModelPageTemplateConfig } from './model-page-template-registry';
import type { ModelPagePricingPreset } from './model-page-template-types';

export type ModelDecisionLink = {
  label: string;
  href: string;
};

export type ModelDecisionFeature = {
  title: string;
  body: string;
  tone: 'audio' | 'continuity' | 'reference' | 'quality' | 'duration' | 'price';
};

export type ModelDecisionCard = {
  title: string;
  body: string;
  cta: ModelDecisionLink;
};

export type ModelDecisionReferenceWorkflow = {
  title: string;
  body: string;
};

export type ModelDecisionData = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    subtitleHighlights: string[];
    paragraph: string;
    primaryCta: ModelDecisionLink;
    secondaryCta: ModelDecisionLink;
    quickLinks: ModelDecisionLink[];
  };
  media: {
    caption: string;
    description: string;
    renderLabel: string;
    badges: string[];
    altContext: string;
  };
  features: ModelDecisionFeature[];
  decisionCards: ModelDecisionCard[];
  referenceWorkflows: ModelDecisionReferenceWorkflow[];
  pricing: {
    title: string;
    subtitle: string;
    footnote: string;
    cta: ModelDecisionLink;
    scenarios: ModelDecisionPricingScenario[];
  };
  meta: {
    title: string;
    description: string;
  };
};

export function buildModelDecisionPricingScenarios(
  entry: FalEngineEntry,
  locale: AppLocale,
  presets: ModelPagePricingPreset[]
) {
  return buildDecisionPricingScenarios(entry, locale, presets);
}

function comparisonSlugFromHref(href: string): string | null {
  const pathname = href.split(/[?#]/, 1)[0] ?? '';
  return pathname.match(/^\/(?:ai-video-engines|fr\/comparatif|es\/comparativa)\/([^/]+)$/)?.[1] ?? null;
}

function isPublishedDecisionHref(
  href: string,
  isComparisonPublished: (slug: string) => boolean,
): boolean {
  const comparisonSlug = comparisonSlugFromHref(href);
  return comparisonSlug === null || isComparisonPublished(comparisonSlug);
}

function publishedLinkOrFallback(
  link: ModelDecisionLink,
  fallbackHref: string,
  isComparisonPublished: (slug: string) => boolean,
): ModelDecisionLink {
  return isPublishedDecisionHref(link.href, isComparisonPublished) ? link : { ...link, href: fallbackHref };
}

export function buildModelDecisionData({
  engine,
  locale,
  decisionContent,
  isComparisonPublished = isPublishedComparisonSlug,
}: {
  engine: FalEngineEntry;
  locale: AppLocale;
  decisionContent: unknown;
  isComparisonPublished?: (slug: string) => boolean;
}): ModelDecisionData | null {
  const template = getModelPageTemplateConfig(engine.modelSlug);

  if (!template) return null;

  const copy = parseModelDecisionContent(
    decisionContent,
    engine.modelSlug,
    locale,
    `content/models/${locale}/${engine.modelSlug}.json#decision`
  );
  const scenarios = buildModelDecisionPricingScenarios(engine, locale, template.pricing.presets).map((scenario) =>
    scenario.id === 'max-duration' && copy.pricingCopy.maxDurationNote
      ? { ...scenario, note: copy.pricingCopy.maxDurationNote }
      : scenario
  );

  return {
    hero: {
      ...copy.hero,
      primaryCta: publishedLinkOrFallback(copy.hero.primaryCta, template.hero.primaryCtaHref, isComparisonPublished),
      secondaryCta: publishedLinkOrFallback(copy.hero.secondaryCta, template.hero.secondaryCtaHref, isComparisonPublished),
      quickLinks: copy.hero.quickLinks.filter((link) => isPublishedDecisionHref(link.href, isComparisonPublished)),
    },
    media: copy.media,
    features: copy.features,
    decisionCards: copy.decisionCards.filter((card) => isPublishedDecisionHref(card.cta.href, isComparisonPublished)),
    referenceWorkflows: copy.referenceWorkflows,
    meta: copy.meta,
    pricing: {
      title: copy.pricingCopy.title,
      subtitle: copy.pricingCopy.subtitle,
      footnote: copy.pricingCopy.footnote,
      cta: publishedLinkOrFallback(
        { label: copy.pricingCopy.ctaLabel, href: copy.pricingCopy.ctaHref },
        template.pricing.anchorHref,
        isComparisonPublished,
      ),
      scenarios,
    },
  };
}
