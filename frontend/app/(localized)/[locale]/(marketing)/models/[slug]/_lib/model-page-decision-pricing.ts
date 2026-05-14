import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';

import { getImagePresetQuote, getPresetQuote, type VideoPriceScenario } from '../../../pricing/_lib/pricingHubData';
import type {
  ModelPageFixedPricingPreset,
  ModelPageImagePricingPreset,
  ModelPagePricingPreset,
  ModelPageVideoPricingPreset,
} from './model-page-template-types';

export type ModelDecisionPricingScenario = {
  id: string;
  label: string;
  value: string;
  note: string;
  badge?: string;
};

const SCENARIO_COPY: Record<
  AppLocale,
  Record<string, string>
> = {
  en: {
    audio: 'Audio',
    audioExtraValue: '$0 extra',
    audioLedWorkflow: 'Audio-led workflow',
    checkLiveQuote: 'Check live quote',
    commonProductionCheck: 'Common production check',
    deliveryRender: 'Delivery render',
    entryDraft: 'Entry draft',
    eightSeconds1080p: '8s · 1080p',
    finalDelivery: 'Final delivery',
    fourSeconds720p: '4s · 720p',
    fourGeneratedImages: '4 generated images · $0.06/image',
    fourKImage: '4K image',
    fourKStill: '4K still',
    fourKReference: '4K reference',
    generateModesOnly: 'Generate modes only',
    imageBatch: 'Reference set',
    highResolutionStill: 'High-resolution still',
    imagePrep: 'Reference prep',
    imageToVideo1080pCheck: 'I2V 1080p check',
    imageToVideoRouteOnly: 'Image-to-video route',
    maxDuration: 'Max duration',
    mostPopular: 'Most popular',
    motionDraft: 'Motion draft',
    nativeAudioIncluded: 'Native audio included',
    nativeAudioWorkflow: 'Native-audio workflow',
    nativeAudioShot: 'Native-audio shot',
    native4K: 'Native 4K',
    polishedShort: 'Polished short',
    productStill: 'Product still',
    proWorkflow: 'Pro workflow',
    referenceBatch: 'Reference batch',
    referenceEditSet: 'Reference edit set',
    storyboardPass: 'Storyboard pass',
    standardPreview: 'Standard preview',
    singleGeneratedStill: 'Single generated still',
    stillImage: 'Still image',
    twoKImage: '2K image',
    twoKStill: '2K still',
    fourKHeroStill: '4K hero still',
    mediumVariantSet: '4 medium variants',
    stylizedDraft: 'Stylized draft',
    socialLoop: 'Social loop',
    twelveSeconds1080p: '12s · 1080p',
    upTo15Images: 'Up to 15 generated/reference images total',
    upTo4K: 'Up to 4K',
    upTo720p: 'Up to 720p',
    upTo768p: 'Up to 768p',
    upTo1080p: 'Up to 1080p',
  },
  fr: {
    audio: 'Audio',
    audioExtraValue: '0 $ en plus',
    audioLedWorkflow: 'Workflow piloté par audio',
    checkLiveQuote: 'Prix live à vérifier',
    commonProductionCheck: 'Contrôle production courant',
    deliveryRender: 'Rendu de livraison',
    entryDraft: 'Brouillon d’entrée',
    eightSeconds1080p: '8 s · 1080p',
    finalDelivery: 'Livraison finale',
    fourSeconds720p: '4 s · 720p',
    fourGeneratedImages: '4 images générées · 0,06 $/image',
    fourKImage: 'Image 4K',
    fourKStill: 'Still 4K',
    fourKReference: 'Référence 4K',
    generateModesOnly: 'Modes Generate uniquement',
    imageBatch: 'Jeu de références',
    highResolutionStill: 'Image haute résolution',
    imagePrep: 'Préparation référence',
    imageToVideo1080pCheck: 'Check I2V 1080p',
    imageToVideoRouteOnly: 'Route image-to-video',
    maxDuration: 'Durée max',
    mostPopular: 'Populaire',
    motionDraft: 'Brouillon mouvement',
    nativeAudioIncluded: 'Audio natif inclus',
    nativeAudioWorkflow: 'Workflow audio natif',
    nativeAudioShot: 'Plan avec audio natif',
    native4K: '4K native',
    polishedShort: 'Short finalisé',
    productStill: 'Packshot produit',
    proWorkflow: 'Workflow Pro',
    referenceBatch: 'Batch référence',
    referenceEditSet: 'Set de retouches référence',
    storyboardPass: 'Passe storyboard',
    standardPreview: 'Aperçu standard',
    singleGeneratedStill: 'Image fixe générée',
    stillImage: 'Image fixe',
    twoKImage: 'Image 2K',
    twoKStill: 'Still 2K',
    fourKHeroStill: 'Hero still 4K',
    mediumVariantSet: '4 variantes medium',
    stylizedDraft: 'Brouillon stylisé',
    socialLoop: 'Boucle sociale',
    twelveSeconds1080p: '12 s · 1080p',
    upTo15Images: 'Jusqu’à 15 images générées/références au total',
    upTo4K: 'Jusqu’à 4K',
    upTo720p: 'Jusqu’à 720p',
    upTo768p: 'Jusqu’à 768p',
    upTo1080p: 'Jusqu’à 1080p',
  },
  es: {
    audio: 'Audio',
    audioExtraValue: '0 $ extra',
    audioLedWorkflow: 'Flujo guiado por audio',
    checkLiveQuote: 'Revisar precio en vivo',
    commonProductionCheck: 'Revisión común de producción',
    deliveryRender: 'Render de entrega',
    entryDraft: 'Borrador inicial',
    eightSeconds1080p: '8 s · 1080p',
    finalDelivery: 'Entrega final',
    fourSeconds720p: '4 s · 720p',
    fourGeneratedImages: '4 imágenes generadas · 0,06 $/imagen',
    fourKImage: 'Imagen 4K',
    fourKStill: 'Still 4K',
    fourKReference: 'Referencia 4K',
    generateModesOnly: 'Solo modos Generate',
    imageBatch: 'Set de referencias',
    highResolutionStill: 'Imagen de alta resolución',
    imagePrep: 'Preparación de referencias',
    imageToVideo1080pCheck: 'Check I2V 1080p',
    imageToVideoRouteOnly: 'Ruta image-to-video',
    maxDuration: 'Duración máxima',
    mostPopular: 'Popular',
    motionDraft: 'Borrador de movimiento',
    nativeAudioIncluded: 'Audio nativo incluido',
    nativeAudioWorkflow: 'Flujo con audio nativo',
    nativeAudioShot: 'Toma con audio nativo',
    native4K: '4K nativo',
    polishedShort: 'Short pulido',
    productStill: 'Still de producto',
    proWorkflow: 'Flujo Pro',
    referenceBatch: 'Batch de referencias',
    referenceEditSet: 'Set de ediciones con referencia',
    storyboardPass: 'Pasada de storyboard',
    standardPreview: 'Vista previa estándar',
    singleGeneratedStill: 'Imagen fija generada',
    stillImage: 'Imagen fija',
    twoKImage: 'Imagen 2K',
    twoKStill: 'Still 2K',
    fourKHeroStill: 'Hero still 4K',
    mediumVariantSet: '4 variantes medium',
    stylizedDraft: 'Borrador estilizado',
    socialLoop: 'Loop social',
    twelveSeconds1080p: '12 s · 1080p',
    upTo15Images: 'Hasta 15 imágenes generadas/referencias en total',
    upTo4K: 'Hasta 4K',
    upTo720p: 'Hasta 720p',
    upTo768p: 'Hasta 768p',
    upTo1080p: 'Hasta 1080p',
  },
};

function formatSeconds(seconds: number, locale: AppLocale) {
  return locale === 'en' ? `${seconds}s` : `${seconds} s`;
}

function getMaxDurationSeconds(entry: FalEngineEntry) {
  return entry.engine.pricingDetails?.maxDurationSec ?? entry.engine.maxDurationSec;
}

function getPricingLabel(locale: AppLocale, key: string) {
  const copy = SCENARIO_COPY[locale] ?? SCENARIO_COPY.en;
  return copy[key] ?? SCENARIO_COPY.en[key] ?? key;
}

function isFixedPreset(preset: ModelPagePricingPreset): preset is ModelPageFixedPricingPreset {
  return typeof preset.fixedValueKey === 'string';
}

function isImagePreset(preset: ModelPagePricingPreset): preset is ModelPageImagePricingPreset {
  return typeof preset.imageResolution === 'string';
}

function isVideoPreset(preset: ModelPagePricingPreset): preset is ModelPageVideoPricingPreset {
  return typeof preset.seconds === 'number' && typeof preset.resolution === 'string';
}

function buildPricedScenarioPreset(preset: ModelPageVideoPricingPreset): VideoPriceScenario {
  return {
    id: preset.id,
    label: `${preset.seconds}s ${preset.resolution}`,
    subLabel: preset.labelKey,
    resolution: preset.resolution,
    durationSec: preset.seconds,
    audio: preset.audio ?? false,
  };
}

function buildScenarioFromPreset({
  entry,
  locale,
  preset,
}: {
  entry: FalEngineEntry;
  locale: AppLocale;
  preset: ModelPagePricingPreset;
}): ModelDecisionPricingScenario {
  if (isFixedPreset(preset) && preset.fixedValueKey === 'audioExtraValue') {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: getPricingLabel(locale, 'audioExtraValue'),
      note: getPricingLabel(locale, preset.noteKey ?? 'nativeAudioIncluded'),
    };
  }

  if (isFixedPreset(preset) && preset.fixedValueKey === 'maxDurationValue') {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: formatSeconds(getMaxDurationSeconds(entry), locale),
      note: getPricingLabel(locale, preset.noteKey ?? 'upTo1080p'),
    };
  }

  if (isImagePreset(preset)) {
    const quote = getImagePresetQuote(
      entry,
      {
        id: preset.id,
        resolution: preset.imageResolution,
        quality: preset.imageQuality,
        quantity: preset.quantity,
      },
      locale
    );

    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: quote.display ?? '',
      note: preset.noteKey ? getPricingLabel(locale, preset.noteKey) : (quote.note ?? preset.imageResolution),
      badge: preset.highlightKey ? getPricingLabel(locale, preset.highlightKey) : undefined,
    };
  }

  if (!isVideoPreset(preset)) {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: '',
      note: getPricingLabel(locale, preset.noteKey ?? 'upTo1080p'),
    };
  }

  const quote = getPresetQuote(entry, buildPricedScenarioPreset(preset), locale);

  return {
    id: preset.id,
    label: getPricingLabel(locale, preset.labelKey),
    value: quote.display ?? '',
    note: preset.noteKey ? getPricingLabel(locale, preset.noteKey) : (quote.note ?? `${formatSeconds(preset.seconds, locale)} · ${preset.resolution}`),
    badge: preset.highlightKey ? getPricingLabel(locale, preset.highlightKey) : undefined,
  };
}

export function buildDecisionPricingScenarios(
  entry: FalEngineEntry,
  locale: AppLocale,
  presets: ModelPagePricingPreset[]
): ModelDecisionPricingScenario[] {
  return presets.map((preset) => buildScenarioFromPreset({ entry, locale, preset }));
}
