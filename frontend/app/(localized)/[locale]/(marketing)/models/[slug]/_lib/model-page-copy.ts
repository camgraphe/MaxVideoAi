import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { getSuggestedOpponentSlugs } from '@/lib/compare-hub/data';
import type { EngineLocalizedContent } from '@/lib/models/i18n';
import { getDefaultSecondaryModelHref } from './model-page-links';
import {
  HERO_SPEC_ICON_MAP,
  isPending,
  isUnsupported,
  normalizeBestUseCaseItems,
  normalizeMaxResolution,
  type BestUseCaseItem,
  type HeroSpecChip,
  type HeroSpecIconKey,
  type KeySpecValues,
  type LocalizedFaqEntry,
  type PromptingTab,
  type PromptingTabId,
  type QuickStartBlock,
  type RelatedItem,
  type SoraCopy,
  type SpecSection,
} from './model-page-specs';

export const DEFAULT_VIDEO_TROUBLESHOOTING = [
  'Feels random / inconsistent → simplify to: subject + action + camera + lighting. Re-run 2–3 takes.',
  'Motion looks weird → reduce movement: one camera move, slower action, fewer props.',
  'Subject drifts off-brand → start from a reference image and lock palette + lighting.',
  'Text looks wrong → avoid readable signage, tiny UI, micro labels. Keep text off-screen.',
  'Dialogue drifts → keep lines short and punchy; avoid long monologues.',
];

export const DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_TROUBLESHOOTING,
  fr: [
    'Résultat aléatoire / incohérent → simplifiez : sujet + action + caméra + lumière. Relancez 2–3 variantes.',
    'Mouvement étrange → réduisez le mouvement : un seul move caméra, action plus lente, moins d’accessoires.',
    'Le sujet dérive de la marque → partez d’une image de référence et verrouillez palette + lumière.',
    'Texte incorrect → évitez la signalétique lisible, les micro‑labels, les petits UI. Gardez le texte hors champ.',
    'Dialogue instable → gardez les répliques courtes et percutantes; évitez les longs monologues.',
  ],
  es: [
    'Se siente aleatorio / inconsistente → simplifica: sujeto + acción + cámara + iluminación. Repite 2–3 tomas.',
    'El movimiento se ve raro → reduce el movimiento: un solo movimiento de cámara, acción más lenta, menos props.',
    'El sujeto se sale de la marca → empieza con una imagen de referencia y fija paleta + iluminación.',
    'El texto sale mal → evita señalética legible, UI pequeño, micro‑labels. Mantén el texto fuera de plano.',
    'El diálogo deriva → mantén líneas cortas y directas; evita monólogos largos.',
  ],
};

export const DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_TROUBLESHOOTING.filter((item) => !item.toLowerCase().includes('dialogue')),
  fr: DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE.fr.filter((item) => !item.toLowerCase().includes('dialogue')),
  es: DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE.es.filter((item) => !item.toLowerCase().includes('diálogo')),
};

export function getDefaultVideoTroubleshooting(locale: AppLocale, supportsAudio: boolean): string[] {
  if (supportsAudio) {
    return DEFAULT_VIDEO_TROUBLESHOOTING_BY_LOCALE[locale] ?? DEFAULT_VIDEO_TROUBLESHOOTING;
  }
  return DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE[locale] ?? DEFAULT_VIDEO_TROUBLESHOOTING_NO_AUDIO_BY_LOCALE.en;
}

export const DEFAULT_VIDEO_SAFETY = [
  'Don’t generate real people or public figures (celebrities, politicians, etc.).',
  'No minors, sexual content, hateful content, or graphic violence.',
  'Don’t use someone’s likeness without consent.',
  'Some prompts and reference images may be blocked — generic characters and scenes are fine.',
];

export const DEFAULT_GENERIC_SAFETY = DEFAULT_VIDEO_SAFETY;

const DEFAULT_VIDEO_SAFETY_BY_LOCALE: Record<AppLocale, string[]> = {
  en: DEFAULT_VIDEO_SAFETY,
  fr: [
    'Ne générez pas de personnes réelles ni de personnalités publiques (célébrités, responsables politiques, etc.).',
    'Pas de mineurs, contenu sexuel, contenu haineux ou violence graphique.',
    "N'utilisez pas l'image ou la ressemblance d'une personne sans son consentement.",
    'Certains prompts et images de référence peuvent être bloqués ; les personnages et scènes génériques sont acceptés.',
  ],
  es: [
    'No generes personas reales ni figuras públicas (celebridades, políticos, etc.).',
    'Sin menores, contenido sexual, contenido de odio ni violencia gráfica.',
    'No uses la imagen o el parecido de una persona sin su consentimiento.',
    'Algunos prompts e imágenes de referencia pueden bloquearse; los personajes y escenas genéricos son aceptables.',
  ],
};

export function getDefaultGenericSafety(locale: AppLocale): string[] {
  return DEFAULT_VIDEO_SAFETY_BY_LOCALE[locale] ?? DEFAULT_VIDEO_SAFETY_BY_LOCALE.en;
}

export function pickCompareEngines(allEngines: FalEngineEntry[], currentSlug: string, limit = 3): FalEngineEntry[] {
  const filtered = allEngines.filter((entry) => {
    if (entry.modelSlug === currentSlug) return false;
    const modes = entry.engine?.modes ?? [];
    const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
    return hasVideoMode;
  });
  const filteredBySlug = new Map(filtered.map((entry) => [entry.modelSlug, entry]));

  const selected: FalEngineEntry[] = [];
  const usedFamilies = new Set<string>();
  const usedSlugs = new Set<string>();
  const registerEngine = (entry: FalEngineEntry) => {
    if (usedSlugs.has(entry.modelSlug)) return;
    selected.push(entry);
    usedSlugs.add(entry.modelSlug);
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    usedFamilies.add(familyKey);
  };

  const priorityTargets = getSuggestedOpponentSlugs(currentSlug, limit);
  for (const targetSlug of priorityTargets) {
    const target = filteredBySlug.get(targetSlug);
    if (!target) continue;
    registerEngine(target);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    const familyKey = entry.family ?? entry.brandId ?? entry.provider ?? entry.modelSlug;
    if (usedFamilies.has(familyKey)) continue;
    registerEngine(entry);
    if (selected.length >= limit) return selected;
  }

  for (const entry of filtered) {
    if (selected.includes(entry)) continue;
    selected.push(entry);
    if (selected.length >= limit) break;
  }

  return selected;
}

export function buildVideoBoundaries(values: KeySpecValues | null): string[] {
  if (!values) {
    return [
      'Output is short-form. For longer edits, stitch multiple clips.',
      'Resolution is capped on this tier.',
      'No video input here — start from text or a single reference image.',
      'No fixed seeds — iteration = re-run + refine.',
    ];
  }
  const items: string[] = [];
  const duration = values.maxDuration && !isPending(values.maxDuration) ? values.maxDuration : null;
  const resolution = values.maxResolution && !isPending(values.maxResolution) ? normalizeMaxResolution(values.maxResolution) : null;
  if (duration) {
    items.push(`Output is short-form (${duration}). For longer edits, stitch multiple clips.`);
  }
  if (resolution) {
    items.push(`Resolution tops out at ${resolution} for this tier.`);
  }
  if (isUnsupported(values.videoToVideo)) {
    items.push('No video input here — start from text or a single reference image.');
  }
  if (isUnsupported(values.imageToVideo)) {
    items.push('Image-to-video is not supported on this tier.');
  }
  if (isUnsupported(values.audioOutput)) {
    items.push('No native audio in this tier.');
  }
  if (!items.length) {
    items.push('No fixed seeds — iteration = re-run + refine.');
  } else if (!items.some((item) => item.toLowerCase().includes('seed'))) {
    items.push('No fixed seeds — iteration = re-run + refine.');
  }
  return items;
}

export type DetailCopy = {
  backLabel: string;
  renderLinkLabel: string;
  relatedModelCta: string;
  examplesLinkLabel: string;
  pricingLinkLabel: string;
  overviewTitle: string;
  overview: {
    brand: string;
    engineId: string;
    slug: string;
    logoPolicy: string;
    platformPrice: string;
  };
  logoPolicies: {
    logoAllowed: string;
    textOnly: string;
  };
  promptsTitle: string;
  faqTitle: string;
  buttons: {
    pricing: string;
    launch: string;
  };
  breadcrumb: {
    home: string;
    models: string;
  };
};

export const DEFAULT_DETAIL_COPY: DetailCopy = {
  backLabel: '← Back to models',
  renderLinkLabel: 'View render →',
  relatedModelCta: 'View model →',
  examplesLinkLabel: 'See examples',
  pricingLinkLabel: 'Compare pricing',
  overviewTitle: 'Overview',
  overview: {
    brand: 'Brand',
    engineId: 'Engine ID',
    slug: 'Slug',
    logoPolicy: 'Logo policy',
    platformPrice: 'Live pricing updates inside the Generate workspace.',
  },
  logoPolicies: {
    logoAllowed: 'Logo usage permitted',
    textOnly: 'Text-only (wordmark)',
  },
  promptsTitle: 'Prompt ideas',
  faqTitle: 'FAQ',
  buttons: {
    pricing: 'Open Generate',
    launch: 'Launch workspace',
  },
  breadcrumb: {
    home: 'Home',
    models: 'Models',
  },
};

export const MODEL_OG_IMAGE_MAP: Record<string, string> = {
  'sora-2':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'sora-2-pro':
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'veo-3-1': '/hero/veo-3-1-hero.jpg',
  'veo-3-1-fast': '/hero/veo-3-1-hero.jpg',
  'veo-3-1-lite': '/hero/veo-3-1-hero.jpg',
  'pika-text-to-video': '/hero/pika-22.jpg',
  'minimax-hailuo-02-text': '/hero/minimax-video01.jpg',
};

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
  const getPromptingTabNotes = (): SoraCopy['promptingTabNotes'] => {
    const value = custom['promptingTabNotes'];
    if (!value || typeof value !== 'object') return {};
    const obj = value as Record<string, unknown>;
    const pick = (key: string) => (typeof obj[key] === 'string' ? obj[key] : undefined);
    return {
      quick: pick('quick'),
      structured: pick('structured'),
      pro: pick('pro'),
      storyboard: pick('storyboard'),
    };
  };
  const getPromptingTabs = (): PromptingTab[] => {
    const value = custom['promptingTabs'];
    if (!Array.isArray(value)) return [];
    return value.reduce<PromptingTab[]>((tabs, entry) => {
      if (!entry || typeof entry !== 'object') return tabs;
      const obj = entry as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id : null;
      const label = typeof obj.label === 'string' ? obj.label : null;
      const title = typeof obj.title === 'string' ? obj.title : null;
      const copy = typeof obj.copy === 'string' ? obj.copy : null;
      if (!id || !label || !title || !copy) return tabs;
      tabs.push({
        id: id as PromptingTabId,
        label,
        title,
        description: typeof obj.description === 'string' ? obj.description : undefined,
        copy,
      });
      return tabs;
    }, []);
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
  const promptingGlobalPrinciples = getStringArray('promptingGlobalPrinciples');
  const promptingEngineWhy = getStringArray('promptingEngineWhy');
  const promptingTabNotes = getPromptingTabNotes();
  const promptingTabs = getPromptingTabs();
  const promptingTitle = getString('promptingTitle');
  const promptingIntro = getString('promptingIntro');
  const promptingTip = getString('promptingTip');
  const promptingGuideLabel = getString('promptingGuideLabel');
  const promptingGuideUrl = getString('promptingGuideUrl');
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
    recreateLabel: getString('recreateLabel'),
    promptingTitle,
    promptingIntro,
    promptingTip,
    promptingGuideLabel,
    promptingGuideUrl,
    promptingTabs,
    promptingGlobalPrinciples,
    promptingEngineWhy,
    promptingTabNotes,
    imageTitle: getString('imageTitle'),
    imageIntro: getString('imageIntro'),
    imageFlow: getStringArray('imageFlow'),
    imageWhy: getStringArray('imageWhy'),
    multishotTitle: getString('multishotTitle'),
    multishotIntro1: getString('multishotIntro1'),
    multishotIntro2: getString('multishotIntro2'),
    multishotTips: getStringArray('multishotTips'),
    demoTitle: getString('demoTitle'),
    demoPromptLabel: getString('demoPromptLabel'),
    demoPrompt: getStringArray('demoPrompt'),
    demoNotes: getStringArray('demoNotes'),
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
