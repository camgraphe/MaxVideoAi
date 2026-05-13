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
    commonProductionCheck: 'Common production check',
    entryDraft: 'Entry draft',
    fourKReference: '4K reference',
    imageBatch: 'Reference set',
    imagePrep: 'Reference prep',
    maxDuration: 'Max duration',
    mostPopular: 'Most popular',
    nativeAudioIncluded: 'Native audio included',
    nativeAudioShot: 'Native-audio shot',
    polishedShort: 'Polished short',
    storyboardPass: 'Storyboard pass',
    standardPreview: 'Standard preview',
    stillImage: 'Still image',
    upTo15Images: 'Up to 15 generated/reference images total',
    upTo1080p: 'Up to 1080p',
  },
  fr: {
    audio: 'Audio',
    audioExtraValue: '0 $ en plus',
    commonProductionCheck: 'Contrôle production courant',
    entryDraft: 'Brouillon d’entrée',
    fourKReference: 'Référence 4K',
    imageBatch: 'Jeu de références',
    imagePrep: 'Préparation référence',
    maxDuration: 'Durée max',
    mostPopular: 'Populaire',
    nativeAudioIncluded: 'Audio natif inclus',
    nativeAudioShot: 'Plan avec audio natif',
    polishedShort: 'Short finalisé',
    storyboardPass: 'Passe storyboard',
    standardPreview: 'Aperçu standard',
    stillImage: 'Image fixe',
    upTo15Images: 'Jusqu’à 15 images générées/références au total',
    upTo1080p: 'Jusqu’à 1080p',
  },
  es: {
    audio: 'Audio',
    audioExtraValue: '0 $ extra',
    commonProductionCheck: 'Revisión común de producción',
    entryDraft: 'Borrador inicial',
    fourKReference: 'Referencia 4K',
    imageBatch: 'Set de referencias',
    imagePrep: 'Preparación de referencias',
    maxDuration: 'Duración máxima',
    mostPopular: 'Popular',
    nativeAudioIncluded: 'Audio nativo incluido',
    nativeAudioShot: 'Toma con audio nativo',
    polishedShort: 'Short pulido',
    storyboardPass: 'Pasada de storyboard',
    standardPreview: 'Vista previa estándar',
    stillImage: 'Imagen fija',
    upTo15Images: 'Hasta 15 imágenes generadas/referencias en total',
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
