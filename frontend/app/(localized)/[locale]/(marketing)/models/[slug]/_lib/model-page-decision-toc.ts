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
    pricing: string;
    useCases: string;
  }
> = {
  en: {
    overview: 'On this page',
    pricing: 'Pricing',
    useCases: 'Tips',
  },
  fr: {
    overview: 'Sur cette page',
    pricing: 'Tarifs',
    useCases: 'Conseils',
  },
  es: {
    overview: 'En esta pagina',
    pricing: 'Precios',
    useCases: 'Consejos',
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
  hasSafetySection,
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
  hasSafetySection: boolean;
  hasFaqSection: boolean;
}) {
  const copy = DECISION_TOC_COPY[locale] ?? DECISION_TOC_COPY.en;
  const items: DecisionTocItem[] = [
    { id: 'decision-pricing', label: copy.pricing, visible: true },
    { id: textAnchorId, label: sectionLabels.examples, visible: hasExamples },
    { id: imageAnchorId, label: sectionLabels.prompting, visible: hasTextSection },
    { id: 'tips', label: copy.useCases, visible: hasTipsSection },
    { id: compareAnchorId, label: sectionLabels.compare, visible: hasCompareSection },
    { id: 'specs', label: sectionLabels.specs, visible: hasSpecs },
    { id: 'safety', label: sectionLabels.safety, visible: hasSafetySection },
    { id: 'faq', label: sectionLabels.faq, visible: hasFaqSection },
  ];

  return items.filter((item) => item.visible);
}
