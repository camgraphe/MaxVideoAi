import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';

import { buildDecisionPricingScenarios, type ModelDecisionPricingScenario } from './model-page-decision-pricing';
import { getModelDecisionCopy } from './model-page-template-copy';
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

export function buildModelDecisionData({
  engine,
  locale,
}: {
  engine: FalEngineEntry;
  locale: AppLocale;
}): ModelDecisionData | null {
  const template = getModelPageTemplateConfig(engine.modelSlug);

  if (!template) return null;

  const copy = getModelDecisionCopy(engine.modelSlug, locale);
  if (!copy) return null;
  const scenarios = buildModelDecisionPricingScenarios(engine, locale, template.pricing.presets).map((scenario) =>
    scenario.id === 'max-duration' && copy.pricingCopy.maxDurationNote
      ? { ...scenario, note: copy.pricingCopy.maxDurationNote }
      : scenario
  );

  return {
    hero: copy.hero,
    media: copy.media,
    features: copy.features,
    decisionCards: copy.decisionCards,
    referenceWorkflows: copy.referenceWorkflows,
    meta: copy.meta,
    pricing: {
      title: copy.pricingCopy.title,
      subtitle: copy.pricingCopy.subtitle,
      footnote: copy.pricingCopy.footnote,
      cta: { label: copy.pricingCopy.ctaLabel, href: copy.pricingCopy.ctaHref },
      scenarios,
    },
  };
}
