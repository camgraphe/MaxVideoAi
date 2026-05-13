import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { getEnginePictogram } from '@/lib/engine-branding';
import { getLocalizedCapabilityKeywords, getLocalizedModelUseCases } from '@/lib/ltx-localization';
import { getEngineLocalized } from '@/lib/models/i18n';
import { isImageOnlyModel, isModelInScope } from '@/lib/models/catalog';
import { computeMarketingPriceRange } from '@/lib/pricing-marketing';
import type { ModelGalleryCard, ModelsGalleryCopy } from '@/components/marketing/ModelsGallery';

import {
  buildDefaultModelCompareHref,
  buildModelExamplesHref,
} from './models-catalog-decision-data';
import {
  DEFAULT_CAPABILITY_KEYWORDS,
  DEFAULT_ENGINE_TYPE_LABELS,
  DEFAULT_SCORE_LABEL_MAP,
  DEFAULT_VALUE_CAPABILITY_FALLBACK,
  DEFAULT_VALUE_CONJUNCTION,
  DEFAULT_VALUE_SENTENCE_BY_LOCALE,
  DEFAULT_VALUE_STRENGTHS_FALLBACK,
  MODEL_CARD_DESCRIPTION_OVERRIDES,
  SCORE_LABEL_KEYS,
  USE_CASE_MAP,
  buildValueSentence,
  clampDescription,
  computeOverall,
  deriveStrengths,
  extractMaxDuration,
  extractMaxResolution,
  formatProviderLabel,
  getCatalogBySlug,
  getEngineDisplayName,
  getEngineTypeKey,
  getMinPricePerSecond,
  getPrelaunchPricingLabel,
  getPrelaunchPricingNote,
  loadEngineKeySpecs,
  loadEngineScores,
  resolveSupported,
  sanitizeDescription,
  stripProvider,
  type EngineScore,
  type ModelsPageScope,
} from './models-catalog-utils';

const DECISION_DESCRIPTION_OVERRIDES: Record<string, string> = {
  'seedance-2-0': 'Best for premium multi-shot AI video with native audio, lip sync, and realistic motion.',
  'kling-3-pro': 'Best for controllable cinematic sequences, prompt adherence, image-to-video, and lip sync workflows.',
  'ltx-2-3-fast': 'Best for fast AI video drafts, low-cost prompt testing, and longer clips up to 20 seconds.',
  'pika-text-to-video':
    'Best for stylized social clips and quick text-to-video tests. Check max duration, input modes, and pricing before launch.',
};

export type ModelsCatalogGalleryCopy = ModelsGalleryCopy & {
  scoreLabels?: Record<keyof EngineScore, string>;
  valueSentence?: {
    template?: string;
    strengthsFallback?: string;
    capabilityFallback?: string;
    conjunction?: string;
    useCases?: Record<string, string>;
    capabilityKeywords?: Record<string, string>;
  };
  stats?: ModelsGalleryCopy['stats'] & {
    typeShort?: string;
  };
};

export type ModelsCatalogEngineMetaCopy = Record<
  string,
  {
    displayName?: string;
    description?: string;
    priceBefore?: string;
    versionLabel?: string;
  }
>;

const MODELS_CATALOG_PRIORITY_ORDER = [
  'seedance-2-0',
  'seedance-2-0-fast',
  'kling-3-pro',
  'kling-3-standard',
  'kling-3-4k',
  'veo-3-1',
  'veo-3-1-fast',
  'ltx-2-3-pro',
  'ltx-2-3-fast',
  'sora-2',
  'sora-2-pro',
  'seedance-1-5-pro',
  'veo-3-1-lite',
  'luma-ray-2',
  'luma-ray-2-flash',
  'pika-text-to-video',
  'wan-2-6',
  'wan-2-5',
  'kling-2-6-pro',
  'kling-2-5-turbo',
  'ltx-2-fast',
  'ltx-2',
  'minimax-hailuo-02-text',
  'gpt-image-2',
  'seedream',
  'nano-banana-2',
  'nano-banana-pro',
  'nano-banana',
] as const;

function listPublishedModelsByScope(scope: ModelsPageScope): FalEngineEntry[] {
  const allEngines = listFalEngines();
  const engineIndex = new Map<string, FalEngineEntry>(allEngines.map((entry) => [entry.modelSlug, entry]));
  const priorityEngines = MODELS_CATALOG_PRIORITY_ORDER
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));
  const remainingEngines = allEngines
    .filter((entry) => !MODELS_CATALOG_PRIORITY_ORDER.includes(entry.modelSlug as (typeof MODELS_CATALOG_PRIORITY_ORDER)[number]))
    .sort((a, b) => getEngineDisplayName(a).localeCompare(getEngineDisplayName(b)));

  return [...priorityEngines, ...remainingEngines]
    .filter((entry) => entry.surfaces.modelPage.indexable || entry.surfaces.modelPage.includeInSitemap)
    .filter((entry) => isModelInScope(entry, scope));
}

export async function buildModelsCatalogCards({
  activeLocale,
  engineMetaCopy,
  engineTypeLabelOverrides,
  galleryCopy,
  scope,
}: {
  activeLocale: AppLocale;
  engineMetaCopy: ModelsCatalogEngineMetaCopy;
  engineTypeLabelOverrides?: Record<string, string>;
  galleryCopy: ModelsCatalogGalleryCopy;
  scope: ModelsPageScope;
}): Promise<ModelGalleryCard[]> {
  const engineTypeLabels = {
    ...DEFAULT_ENGINE_TYPE_LABELS,
    ...(engineTypeLabelOverrides ?? {}),
  };
  const keySpecsMap = await loadEngineKeySpecs();
  const scoresMap = await loadEngineScores();
  const catalogBySlug = getCatalogBySlug();
  const engines = listPublishedModelsByScope(scope);

  const localizedMap = new Map<string, Awaited<ReturnType<typeof getEngineLocalized>>>(
    await Promise.all(
      engines.map(async (engine) => {
        const localized = await getEngineLocalized(engine.modelSlug, activeLocale);
        return [engine.modelSlug, localized] as const;
      })
    )
  );
  const pricingRangeMap = new Map(
    await Promise.all(
      engines.map(async (engine) => {
        const range = await computeMarketingPriceRange(engine.engine, { durationSec: 5, memberTier: 'member' });
        return [engine.modelSlug, range] as const;
      })
    )
  );

  const scoreLabelMap = { ...DEFAULT_SCORE_LABEL_MAP, ...(galleryCopy.scoreLabels ?? {}) };
  const scoreLabels = SCORE_LABEL_KEYS.map((key) => ({
    key,
    label: scoreLabelMap[key] ?? DEFAULT_SCORE_LABEL_MAP[key],
  }));
  const valueTemplate = galleryCopy.valueSentence?.template ?? DEFAULT_VALUE_SENTENCE_BY_LOCALE[activeLocale];
  const strengthsFallback =
    galleryCopy.valueSentence?.strengthsFallback ?? DEFAULT_VALUE_STRENGTHS_FALLBACK[activeLocale];
  const capabilityFallback =
    galleryCopy.valueSentence?.capabilityFallback ?? DEFAULT_VALUE_CAPABILITY_FALLBACK[activeLocale];
  const conjunction = galleryCopy.valueSentence?.conjunction ?? DEFAULT_VALUE_CONJUNCTION[activeLocale];
  const useCaseMap = {
    ...USE_CASE_MAP,
    ...getLocalizedModelUseCases(activeLocale),
    ...(galleryCopy.valueSentence?.useCases ?? {}),
  };
  const descriptionOverrides = MODEL_CARD_DESCRIPTION_OVERRIDES[activeLocale] ?? {};
  const capabilityMap = {
    ...DEFAULT_CAPABILITY_KEYWORDS,
    ...getLocalizedCapabilityKeywords(activeLocale),
    ...(galleryCopy.valueSentence?.capabilityKeywords ?? {}),
  };

  return engines.map((engine) => {
    const meta = engineMetaCopy[engine.modelSlug] ?? engineMetaCopy[engine.id] ?? null;
    const localized = localizedMap.get(engine.modelSlug);
    const engineTypeKey = getEngineTypeKey(engine);
    const engineType = engineTypeLabels[engineTypeKey] ?? DEFAULT_ENGINE_TYPE_LABELS[engineTypeKey];
    const versionLabel = localized?.versionLabel ?? meta?.versionLabel ?? engine.versionLabel ?? '';
    const displayName =
      localized?.marketingName ?? meta?.displayName ?? engine.cardTitle ?? getEngineDisplayName(engine);
    const catalogEntry = catalogBySlug.get(engine.modelSlug) ?? null;
    const keySpecs = keySpecsMap.get(engine.modelSlug) ?? {};
    const scoreEntry =
      scoresMap.get(engine.modelSlug) ?? scoresMap.get(engine.engine.id) ?? scoresMap.get(engine.id) ?? null;
    const overallScore = computeOverall(scoreEntry);
    const strengths = deriveStrengths(scoreEntry, scoreLabels);
    const providerId = (engine.brandId ?? engine.engine.brandId ?? catalogEntry?.brandId ?? '').toString().toLowerCase();
    const providerLabel = formatProviderLabel(engine, catalogEntry);
    const engineName = stripProvider(displayName, providerLabel, providerId) || displayName;
    const normalizedVersion = versionLabel.replace(/^v\s*/i, '').trim();
    const hasVersion =
      normalizedVersion &&
      (engineName.toLowerCase().includes(normalizedVersion.toLowerCase()) ||
        engineName.toLowerCase().includes(versionLabel.toLowerCase()));
    const titleLabel = normalizedVersion && !hasVersion ? `${engineName} ${normalizedVersion}` : engineName;
    const modes = new Set(catalogEntry?.engine?.modes ?? engine.engine.modes ?? []);
    const isImageOnly = isImageOnlyModel(engine);
    const t2v = resolveSupported((keySpecs as Record<string, unknown>).textToVideo) ?? modes.has('t2v');
    const i2v = resolveSupported((keySpecs as Record<string, unknown>).imageToVideo) ?? modes.has('i2v');
    const v2v =
      resolveSupported((keySpecs as Record<string, unknown>).videoToVideo) ??
      (modes.has('v2v') || modes.has('reframe'));
    const firstLast =
      resolveSupported((keySpecs as Record<string, unknown>).firstLastFrame) ??
      Boolean(catalogEntry?.engine?.keyframes);
    const extend = Boolean(catalogEntry?.engine?.extend);
    const lipSync = resolveSupported((keySpecs as Record<string, unknown>).lipSync) ?? undefined;
    const audioSupported =
      resolveSupported((keySpecs as Record<string, unknown>).audioOutput) ??
      (catalogEntry?.engine?.audio == null ? null : Boolean(catalogEntry.engine.audio));
    const maxResolution = extractMaxResolution(
      (keySpecs as Record<string, string>).maxResolution,
      catalogEntry?.engine?.resolutions
    );
    const maxDuration = extractMaxDuration(
      (keySpecs as Record<string, string>).maxDuration,
      catalogEntry?.engine?.maxDurationSec ?? null
    );
    const pricingRange = pricingRangeMap.get(engine.modelSlug) ?? null;
    const priceFromCents = pricingRange?.min.cents ?? getMinPricePerSecond(catalogEntry);
    const isPrelaunchWaitlist = engine.availability === 'waitlist';
    const hasConfirmedPricing = !isPrelaunchWaitlist && typeof priceFromCents === 'number' && priceFromCents > 0;
    const showPrelaunchPricePlaceholder = isPrelaunchWaitlist;
    const priceFrom = hasConfirmedPricing
      ? isImageOnly
        ? `$${(priceFromCents / 100).toFixed(2)}`
        : `$${(priceFromCents / 100).toFixed(2)}/s`
      : showPrelaunchPricePlaceholder
        ? getPrelaunchPricingLabel(activeLocale)
        : 'Data pending';
    const capabilityKeywordsList = [
      t2v ? 'T2V' : null,
      i2v ? 'I2V' : null,
      v2v ? 'V2V' : null,
      lipSync ? 'Lip sync' : null,
      audioSupported ? 'Audio' : null,
      firstLast ? 'First/Last' : null,
      extend ? 'Extend' : null,
    ].filter(Boolean) as string[];
    const capabilities = capabilityKeywordsList
      .filter((cap) => cap !== 'Lip sync' && cap !== 'Audio')
      .slice(0, 5) as string[];
    const compareDisabled = ['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2', 'seedream'].includes(
      engine.modelSlug
    );
    const bestForFallback = catalogEntry?.bestFor ? sanitizeDescription(catalogEntry.bestFor) : engineType;
    const generatedDescription =
      DECISION_DESCRIPTION_OVERRIDES[engine.modelSlug] ??
      descriptionOverrides[engine.modelSlug] ??
      buildValueSentence({
        slug: engine.modelSlug,
        strengths,
        capabilities: capabilityKeywordsList,
        fallback: bestForFallback,
        template: valueTemplate,
        strengthsFallback,
        capabilityFallback,
        conjunction,
        useCaseMap,
        capabilityMap,
      });
    const microDescription = clampDescription(generatedDescription, 170);
    const pictogram = getEnginePictogram({
      id: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId,
      label: displayName,
    });

    return {
      id: engine.modelSlug,
      label: titleLabel,
      provider: providerLabel,
      engineId: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId ?? null,
      description: microDescription,
      versionLabel,
      overallScore,
      priceNote: showPrelaunchPricePlaceholder ? getPrelaunchPricingNote(activeLocale) : null,
      priceNoteHref: null,
      href: { pathname: '/models/[slug]', params: { slug: engine.modelSlug } },
      compareHref: buildDefaultModelCompareHref(engine.modelSlug),
      examplesHref: buildModelExamplesHref(engine.modelSlug),
      backgroundColor: pictogram.backgroundColor,
      textColor: pictogram.textColor,
      strengths,
      capabilities: capabilities.slice(0, 5),
      stats: {
        priceFrom: priceFrom === 'Data pending' ? '—' : priceFrom,
        maxDuration: isImageOnly ? 'Image' : maxDuration.label === 'Data pending' ? '—' : maxDuration.label,
        maxResolution: maxResolution.label === 'Data pending' ? '—' : maxResolution.label,
      },
      statsLabels: {
        duration: isImageOnly ? galleryCopy.stats?.typeShort ?? 'Type' : undefined,
      },
      audioAvailable: Boolean(audioSupported),
      compareDisabled,
      filterMeta: {
        engineType: isImageOnly ? 'image' : 'video',
        t2v,
        i2v,
        v2v,
        firstLast,
        extend,
        lipSync,
        audio: Boolean(audioSupported),
        maxResolution: maxResolution.value,
        maxDuration: maxDuration.value,
        priceFrom: hasConfirmedPricing ? priceFromCents / 100 : null,
        legacy: Boolean(engine.isLegacy),
      },
    };
  });
}
