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
    finalDelivery: 'Final delivery',
    fourKReference: '4K reference',
    generateModesOnly: 'Generate modes only',
    imageBatch: 'Reference set',
    imagePrep: 'Reference prep',
    maxDuration: 'Max duration',
    mostPopular: 'Most popular',
    motionDraft: 'Motion draft',
    nativeAudioIncluded: 'Native audio included',
    nativeAudioWorkflow: 'Native-audio workflow',
    nativeAudioShot: 'Native-audio shot',
    native4K: 'Native 4K',
    polishedShort: 'Polished short',
    proWorkflow: 'Pro workflow',
    storyboardPass: 'Storyboard pass',
    standardPreview: 'Standard preview',
    stillImage: 'Still image',
    stylizedDraft: 'Stylized draft',
    socialLoop: 'Social loop',
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
    finalDelivery: 'Livraison finale',
    fourKReference: 'Référence 4K',
    generateModesOnly: 'Modes Generate uniquement',
    imageBatch: 'Jeu de références',
    imagePrep: 'Préparation référence',
    maxDuration: 'Durée max',
    mostPopular: 'Populaire',
    motionDraft: 'Brouillon mouvement',
    nativeAudioIncluded: 'Audio natif inclus',
    nativeAudioWorkflow: 'Workflow audio natif',
    nativeAudioShot: 'Plan avec audio natif',
    native4K: '4K native',
    polishedShort: 'Short finalisé',
    proWorkflow: 'Workflow Pro',
    storyboardPass: 'Passe storyboard',
    standardPreview: 'Aperçu standard',
    stillImage: 'Image fixe',
    stylizedDraft: 'Brouillon stylisé',
    socialLoop: 'Boucle sociale',
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
    finalDelivery: 'Entrega final',
    fourKReference: 'Referencia 4K',
    generateModesOnly: 'Solo modos Generate',
    imageBatch: 'Set de referencias',
    imagePrep: 'Preparación de referencias',
    maxDuration: 'Duración máxima',
    mostPopular: 'Popular',
    motionDraft: 'Borrador de movimiento',
    nativeAudioIncluded: 'Audio nativo incluido',
    nativeAudioWorkflow: 'Flujo con audio nativo',
    nativeAudioShot: 'Toma con audio nativo',
    native4K: '4K nativo',
    polishedShort: 'Short pulido',
    proWorkflow: 'Flujo Pro',
    storyboardPass: 'Pasada de storyboard',
    standardPreview: 'Vista previa estándar',
    stillImage: 'Imagen fija',
    stylizedDraft: 'Borrador estilizado',
    socialLoop: 'Loop social',
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
    note: quote.note ?? `${formatSeconds(preset.seconds, locale)} · ${preset.resolution}`,
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
