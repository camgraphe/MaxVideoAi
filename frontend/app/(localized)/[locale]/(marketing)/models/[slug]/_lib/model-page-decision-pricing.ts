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
    fourSeconds720pAudioIncluded: '4s · 720p · audio included',
    fourSeconds720pAudioOn: '4s · 720p · audio on',
    fourGeneratedImages: '4 generated images · $0.06/image',
    fourKImage: '4K image',
    fourKStill: '4K still',
    fourKReference: '4K reference',
    fiveSeconds480p: '5s · 480p',
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
    heroEdit: 'Hero edit',
    storyboardPass: 'Storyboard pass',
    singleEdit: 'Single edit',
    standardPreview: 'Standard preview',
    eightSeconds720p: '8s · 720p',
    tenSeconds1080p: '10s · 1080p',
    tenSeconds1080pDraft: '10s · 1080p draft',
    singleGeneratedStill: 'Single generated still',
    sourceImageEdit: 'Source image edit',
    sourcePlusThreeReferences: 'Source + 3 references',
    stillImage: 'Still image',
    twoKHeroImage: '2K hero image',
    twoKImage: '2K image',
    twoKStill: '2K still',
    fourKHeroStill: '4K hero still',
    fiveSeconds480pAudioIncluded: '5s · 480p · audio included',
    fourSeconds720pAudioOff: '4s · 720p · audio off',
    fiveSeconds1080pAudioOff: '5s · 1080p · audio off',
    fiveSeconds1080pAudioOn: '5s · 1080p · audio on',
    mediumVariantSet: '4 medium variants',
    eightSeconds720pAudioIncluded: '8s · 720p · audio included',
    sixSeconds720pAudioOn: '6s · 720p · audio on',
    sixSeconds720pAudioIncluded: '6s · 720p · audio included',
    eightSeconds1080pAudioOn: '8s · 1080p · audio on',
    stylizedDraft: 'Stylized draft',
    socialLoop: 'Social loop',
    eightSeconds1080pAudioIncluded: '8s · 1080p · audio included',
    tenSeconds720pAudioIncluded: '10s · 720p · audio included',
    tenSeconds1080pAudioOn: '10s · 1080p · audio on',
    fifteenSeconds1080pAudioOn: '15s · 1080p · audio on',
    twelveSeconds1080p: '12s · 1080p',
    upTo15Images: 'Up to 15 generated/reference images total',
    upTo4K: 'Up to 4K',
    upTo720p: 'Up to 720p',
    upTo768p: 'Up to 768p',
    upTo1080p: 'Up to 1080p',
    upTo1080pI2vOnly: '1080p in I2V only',
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
    fourSeconds720pAudioIncluded: '4 s · 720p · audio inclus',
    fourSeconds720pAudioOn: '4 s · 720p · audio activé',
    fourGeneratedImages: '4 images générées · 0,06 $/image',
    fourKImage: 'Image 4K',
    fourKStill: 'Still 4K',
    fourKReference: 'Référence 4K',
    fiveSeconds480p: '5 s · 480p',
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
    heroEdit: 'Retouche hero',
    storyboardPass: 'Passe storyboard',
    singleEdit: 'Retouche simple',
    standardPreview: 'Aperçu standard',
    eightSeconds720p: '8 s · 720p',
    tenSeconds1080p: '10 s · 1080p',
    tenSeconds1080pDraft: '10 s · 1080p brouillon',
    singleGeneratedStill: 'Image fixe générée',
    sourceImageEdit: 'Retouche image source',
    sourcePlusThreeReferences: 'Source + 3 références',
    stillImage: 'Image fixe',
    twoKHeroImage: 'Image hero 2K',
    twoKImage: 'Image 2K',
    twoKStill: 'Still 2K',
    fourKHeroStill: 'Hero still 4K',
    fiveSeconds480pAudioIncluded: '5 s · 480p · audio inclus',
    fourSeconds720pAudioOff: '4 s · 720p · audio désactivé',
    fiveSeconds1080pAudioOff: '5 s · 1080p · audio désactivé',
    fiveSeconds1080pAudioOn: '5 s · 1080p · audio activé',
    mediumVariantSet: '4 variantes medium',
    eightSeconds720pAudioIncluded: '8 s · 720p · audio inclus',
    sixSeconds720pAudioOn: '6 s · 720p · audio activé',
    sixSeconds720pAudioIncluded: '6 s · 720p · audio inclus',
    eightSeconds1080pAudioOn: '8 s · 1080p · audio activé',
    stylizedDraft: 'Brouillon stylisé',
    socialLoop: 'Boucle sociale',
    eightSeconds1080pAudioIncluded: '8 s · 1080p · audio inclus',
    tenSeconds720pAudioIncluded: '10 s · 720p · audio inclus',
    tenSeconds1080pAudioOn: '10 s · 1080p · audio activé',
    fifteenSeconds1080pAudioOn: '15 s · 1080p · audio activé',
    twelveSeconds1080p: '12 s · 1080p',
    upTo15Images: 'Jusqu’à 15 images générées/références au total',
    upTo4K: 'Jusqu’à 4K',
    upTo720p: 'Jusqu’à 720p',
    upTo768p: 'Jusqu’à 768p',
    upTo1080p: 'Jusqu’à 1080p',
    upTo1080pI2vOnly: '1080p en I2V uniquement',
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
    fourSeconds720pAudioIncluded: '4 s · 720p · audio incluido',
    fourSeconds720pAudioOn: '4 s · 720p · audio activado',
    fourGeneratedImages: '4 imágenes generadas · 0,06 $/imagen',
    fourKImage: 'Imagen 4K',
    fourKStill: 'Still 4K',
    fourKReference: 'Referencia 4K',
    fiveSeconds480p: '5 s · 480p',
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
    heroEdit: 'Edición hero',
    storyboardPass: 'Pasada de storyboard',
    singleEdit: 'Edición simple',
    standardPreview: 'Vista previa estándar',
    eightSeconds720p: '8 s · 720p',
    tenSeconds1080p: '10 s · 1080p',
    tenSeconds1080pDraft: '10 s · 1080p borrador',
    singleGeneratedStill: 'Imagen fija generada',
    sourceImageEdit: 'Edición de imagen fuente',
    sourcePlusThreeReferences: 'Fuente + 3 referencias',
    stillImage: 'Imagen fija',
    twoKHeroImage: 'Imagen hero 2K',
    twoKImage: 'Imagen 2K',
    twoKStill: 'Still 2K',
    fourKHeroStill: 'Hero still 4K',
    fiveSeconds480pAudioIncluded: '5 s · 480p · audio incluido',
    fourSeconds720pAudioOff: '4 s · 720p · audio desactivado',
    fiveSeconds1080pAudioOff: '5 s · 1080p · audio desactivado',
    fiveSeconds1080pAudioOn: '5 s · 1080p · audio activado',
    mediumVariantSet: '4 variantes medium',
    eightSeconds720pAudioIncluded: '8 s · 720p · audio incluido',
    sixSeconds720pAudioOn: '6 s · 720p · audio activado',
    sixSeconds720pAudioIncluded: '6 s · 720p · audio incluido',
    eightSeconds1080pAudioOn: '8 s · 1080p · audio activado',
    stylizedDraft: 'Borrador estilizado',
    socialLoop: 'Loop social',
    eightSeconds1080pAudioIncluded: '8 s · 1080p · audio incluido',
    tenSeconds720pAudioIncluded: '10 s · 720p · audio incluido',
    tenSeconds1080pAudioOn: '10 s · 1080p · audio activado',
    fifteenSeconds1080pAudioOn: '15 s · 1080p · audio activado',
    twelveSeconds1080p: '12 s · 1080p',
    upTo15Images: 'Hasta 15 imágenes generadas/referencias en total',
    upTo4K: 'Hasta 4K',
    upTo720p: 'Hasta 720p',
    upTo768p: 'Hasta 768p',
    upTo1080p: 'Hasta 1080p',
    upTo1080pI2vOnly: '1080p solo en I2V',
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
        mode: preset.mode,
        referenceImageCount: preset.referenceImageCount,
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
