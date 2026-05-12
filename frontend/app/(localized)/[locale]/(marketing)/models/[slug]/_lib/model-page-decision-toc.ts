import type { AppLocale } from '@/i18n/locales';

type SectionLabels = {
  specs: string;
  examples: string;
  prompting: string;
  tips: string;
  compare: string;
  safety: string;
  faq: string;
};

type DecisionTocItem = {
  id: string;
  label: string;
  visible: boolean;
};

const DECISION_TOC_COPY: Record<
  AppLocale,
  {
    overview: string;
    capabilities: string;
    pricing: string;
    useCases: string;
  }
> = {
  en: {
    overview: 'On this page',
    capabilities: 'Key capabilities',
    pricing: 'Pricing',
    useCases: 'Best use cases',
  },
  fr: {
    overview: 'Sur cette page',
    capabilities: 'Capacites cles',
    pricing: 'Tarifs',
    useCases: 'Cas d usage',
  },
  es: {
    overview: 'En esta pagina',
    capabilities: 'Capacidades clave',
    pricing: 'Precios',
    useCases: 'Mejores usos',
  },
};

export function resolveDecisionTocOverviewLabel(locale: AppLocale) {
  return (DECISION_TOC_COPY[locale] ?? DECISION_TOC_COPY.en).overview;
}

export function buildDecisionTocItems({
  locale,
  sectionLabels,
  textAnchorId,
  imageAnchorId,
  compareAnchorId,
  hasExamples,
  hasSpecs,
  hasTextSection,
  hasTipsSection,
  hasCompareSection,
  hasFaqSection,
}: {
  locale: AppLocale;
  sectionLabels: SectionLabels;
  textAnchorId: string;
  imageAnchorId: string;
  compareAnchorId: string;
  hasExamples: boolean;
  hasSpecs: boolean;
  hasTextSection: boolean;
  hasTipsSection: boolean;
  hasCompareSection: boolean;
  hasFaqSection: boolean;
}) {
  const copy = DECISION_TOC_COPY[locale] ?? DECISION_TOC_COPY.en;
  const items: DecisionTocItem[] = [
    { id: textAnchorId, label: sectionLabels.examples, visible: hasExamples },
    { id: 'specs', label: copy.capabilities, visible: hasSpecs },
    { id: 'decision-pricing', label: copy.pricing, visible: true },
    { id: imageAnchorId, label: sectionLabels.prompting, visible: hasTextSection },
    { id: 'tips', label: copy.useCases, visible: hasTipsSection },
    { id: compareAnchorId, label: sectionLabels.compare, visible: hasCompareSection },
    { id: 'faq', label: sectionLabels.faq, visible: hasFaqSection },
  ];

  return items.filter((item) => item.visible);
}
