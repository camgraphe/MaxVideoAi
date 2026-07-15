import type { AppLocale } from '@/i18n/locales';
import type { EngineLocalizedContent } from '@/lib/models/i18n';
import { getDefaultSecondaryModelHref } from './model-page-links';
import {
  HERO_SPEC_ICON_MAP,
  normalizeBestUseCaseItems,
  type BestUseCaseItem,
  type HeroSpecChip,
  type HeroSpecIconKey,
  type LocalizedFaqEntry,
  type QuickStartBlock,
  type RelatedItem,
  type SoraCopy,
  type SpecSection,
} from './model-page-specs';

export {
  DEFAULT_DETAIL_COPY,
  DEFAULT_GENERIC_SAFETY,
  DEFAULT_VIDEO_SAFETY,
  DEFAULT_VIDEO_TROUBLESHOOTING,
  DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE,
  DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE,
  MODEL_OG_IMAGE_MAP,
  getDefaultGenericSafety,
  getDefaultVideoTroubleshooting,
} from './model-page-default-copy';
export type { DetailCopy } from './model-page-default-copy';
export {
  buildVideoBoundaries,
  pickCompareEngines,
} from './model-page-copy-helpers';

export function buildSoraCopy(localized: EngineLocalizedContent, slug: string, locale: AppLocale): SoraCopy {
  const custom = (localized.custom ?? {}) as Record<string, unknown>;
  const getValue = (key: string): unknown => {
    const customValue = custom[key];
    if (customValue !== undefined) return customValue;
    return (localized as Record<string, unknown>)[key];
  };
  const getString = (key: string): string | null => {
    const value = getValue(key);
    return typeof value === 'string' && value.trim().length ? value : null;
  };
  const getRecreateLabel = (): string | null => {
    const value = getString('recreateLabel');
    if (locale === 'fr' && (!value || /^Recreate\b/i.test(value))) return 'Recréer ce rendu →';
    if (locale === 'es' && (!value || /^Recreate\b/i.test(value))) return 'Recrear este resultado →';
    return value;
  };
  const getBoolean = (key: string): boolean => getValue(key) === true;
  const getStringArray = (key: string): string[] => {
    const value = getValue(key);
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean);
    }
    return [];
  };
  const getFaqs = (): LocalizedFaqEntry[] => {
    const value = custom['faqs'];
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const obj = entry as Record<string, unknown>;
        const question = typeof obj.q === 'string' ? obj.q : typeof obj.question === 'string' ? obj.question : null;
        const answer = typeof obj.a === 'string' ? obj.a : typeof obj.answer === 'string' ? obj.answer : null;
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((faq): faq is LocalizedFaqEntry => Boolean(faq));
  };
  const getSpecSections = (): SpecSection[] => {
    const value = custom['specSections'];
    if (!Array.isArray(value)) return [];
    const sections: SpecSection[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title : null;
      const intro = typeof obj.intro === 'string' ? obj.intro : null;
      const itemsRaw = obj.items;
      const items = Array.isArray(itemsRaw)
        ? itemsRaw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
        : [];
      if (!title || !items.length) continue;
      sections.push({ title, items, intro });
    }
    return sections;
  };
  const getQuickStartBlocks = (): QuickStartBlock[] => {
    const value = custom['quickStartBlocks'];
    if (!Array.isArray(value)) return [];
    return value.reduce<QuickStartBlock[]>((blocks, entry) => {
      if (!entry || typeof entry !== 'object') return blocks;
      const obj = entry as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title : null;
      const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle : null;
      const stepsRaw = obj.steps;
      const steps = Array.isArray(stepsRaw)
        ? stepsRaw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
        : [];
      if (!title || !steps.length) return blocks;
      blocks.push({ title, subtitle, steps });
      return blocks;
    }, []);
  };
  const getHeroSpecChips = (): HeroSpecChip[] => {
    const value = custom['heroSpecChips'];
    if (!Array.isArray(value)) return [];
    return value.reduce<HeroSpecChip[]>((chips, entry) => {
      if (!entry || typeof entry !== 'object') return chips;
      const obj = entry as Record<string, unknown>;
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      if (!label) return chips;
      const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
      const icon = (rawIcon in HERO_SPEC_ICON_MAP ? rawIcon : null) as HeroSpecIconKey | null;
      chips.push({ label, icon });
      return chips;
    }, []);
  };
  const getRelatedItems = (): RelatedItem[] => {
    const value = custom['relatedItems'];
    if (!Array.isArray(value)) return [];
    return value.reduce<RelatedItem[]>((items, entry) => {
      if (!entry || typeof entry !== 'object') return items;
      const obj = entry as Record<string, unknown>;
      const brand = typeof obj.brand === 'string' ? obj.brand.trim() : '';
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      const description = typeof obj.description === 'string' ? obj.description.trim() : '';
      if (!brand || !title || !description) return items;
      const modelSlug = typeof obj.modelSlug === 'string' ? obj.modelSlug.trim() : null;
      const ctaLabel = typeof obj.ctaLabel === 'string' ? obj.ctaLabel.trim() : null;
      const href = typeof obj.href === 'string' ? obj.href.trim() : null;
      items.push({ brand, title, description, modelSlug, ctaLabel, href });
      return items;
    }, []);
  };
  const getBestUseCaseItems = (): BestUseCaseItem[] => {
    const value = custom['bestUseCases'];
    const normalized = normalizeBestUseCaseItems(value, locale);
    if (normalized.length) return normalized;
    return normalizeBestUseCaseItems(localized.bestUseCases?.items ?? [], locale);
  };

  const fallbackSpecSections = (): SpecSection[] => {
    if (!localized.technicalOverview || !localized.technicalOverview.length) return [];
    const items = localized.technicalOverview
      .map((entry) => {
        if (!entry?.body) return entry?.label ?? null;
        if (entry.label) return `${entry.label}: ${entry.body}`;
        return entry.body;
      })
      .filter((item): item is string => Boolean(item && item.trim().length));
    if (!items.length) return [];
    return [
      {
        title: localized.technicalOverviewTitle ?? 'Specs',
        items,
      },
    ];
  };

  const bestUseCasesTitle = localized.bestUseCases?.title ?? getString('bestUseCasesTitle') ?? 'Best use cases';
  const bestUseCaseItems = getBestUseCaseItems();
  const bestUseCases = bestUseCaseItems.map((item) => item.title);
  const heroHighlights = getStringArray('heroHighlights').length
    ? getStringArray('heroHighlights')
    : bestUseCases.slice(0, 4);
  const specSections = (() => {
    const sections = getSpecSections();
    if (sections.length) return sections;
    return fallbackSpecSections();
  })();
  const specTitle = getString('specTitle') ?? localized.technicalOverviewTitle ?? 'Specs';
  const specNote = getString('specNote') ?? localized.pricingNotes ?? null;
  const tipsIntro = getString('tipsIntro');

  return {
    heroEyebrow: getString('heroEyebrow'),
    heroTitle: localized.hero?.title ?? getString('heroTitle'),
    heroSubtitle: localized.hero?.intro ?? getString('heroSubtitle'),
    heroSupportLine: getString('heroSupportLine'),
    heroBadge: localized.hero?.badge ?? getString('heroBadge'),
    heroSpecChips: getHeroSpecChips(),
    heroTrustLine: getString('heroTrustLine'),
    heroDesc1: getString('heroDesc1'),
    heroDesc2: getString('heroDesc2'),
    primaryCta: localized.hero?.ctaPrimary?.label ?? getString('primaryCta'),
    primaryCtaHref: localized.hero?.ctaPrimary?.href ?? `/app?engine=${slug}`,
    secondaryCta:
      (localized.hero?.secondaryLinks?.[0]?.label as string | undefined) ??
      getString('secondaryCta') ??
      localized.compareLink?.label ??
      null,
    secondaryCtaHref:
      (localized.hero?.secondaryLinks?.[0]?.href as string | undefined) ??
      localized.compareLink?.href ??
      getDefaultSecondaryModelHref(slug),
    whyTitle: getString('whyTitle'),
    heroHighlights,
    bestUseCasesTitle,
    bestUseCaseItems,
    bestUseCases,
    whatTitle: getString('whatTitle'),
    whatIntro1: getString('whatIntro1'),
    whatIntro2: getString('whatIntro2'),
    whatFlowTitle: getString('whatFlowTitle'),
    whatFlowSteps: getStringArray('whatFlowSteps'),
    quickStartTitle: getString('quickStartTitle'),
    quickStartBlocks: getQuickStartBlocks(),
    howToLatamTitle: getString('howToLatamTitle'),
    howToLatamSteps: getStringArray('howToLatamSteps'),
    specTitle,
    specNote,
    specSections,
    specValueProp: getString('specValueProp'),
    quickPricingTitle: getString('quickPricingTitle'),
    quickPricingItems: getStringArray('quickPricingItems'),
    hideQuickPricing: getBoolean('hideQuickPricing'),
    showPricePerSecondInSpecs: getBoolean('showPricePerSecondInSpecs'),
    hidePricingSection: getBoolean('hidePricingSection'),
    microCta: getString('microCta'),
    galleryTitle: getString('galleryTitle'),
    galleryIntro: getString('galleryIntro'),
    gallerySceneCta: getString('gallerySceneCta'),
    galleryAllCta: getString('galleryAllCta'),
    recreateLabel: getRecreateLabel(),
    imageTitle: getString('imageTitle'),
    imageIntro: getString('imageIntro'),
    imageFlow: getStringArray('imageFlow'),
    imageWhy: getStringArray('imageWhy'),
    multishotTitle: getString('multishotTitle'),
    multishotIntro1: getString('multishotIntro1'),
    multishotIntro2: getString('multishotIntro2'),
    multishotTips: getStringArray('multishotTips'),
    tipsTitle: getString('tipsTitle'),
    tipsIntro,
    strengths: getStringArray('strengths').length
      ? getStringArray('strengths')
      : localized.tips?.items ?? [],
    boundaries: getStringArray('boundaries'),
    troubleshootingTitle: getString('troubleshootingTitle'),
    troubleshootingItems: getStringArray('troubleshootingItems'),
    tipsFooter: getString('tipsFooter'),
    safetyTitle: getString('safetyTitle'),
    safetyRules: getStringArray('safetyRules'),
    safetyInterpretation: getStringArray('safetyInterpretation'),
    safetyNote: getString('safetyNote'),
    comparisonTitle: getString('comparisonTitle'),
    comparisonPoints: getStringArray('comparisonPoints'),
    comparisonCta: getString('comparisonCta'),
    relatedCtaSora2: getString('relatedCtaSora2'),
    relatedCtaSora2Pro: getString('relatedCtaSora2Pro'),
    relatedTitle: getString('relatedTitle'),
    relatedSubtitle: getString('relatedSubtitle'),
    relatedItems: getRelatedItems(),
    finalPara1: getString('finalPara1'),
    finalPara2: getString('finalPara2'),
    finalButton: getString('finalButton'),
    faqTitle: getString('faqTitle'),
    faqs: getFaqs(),
  };
}
