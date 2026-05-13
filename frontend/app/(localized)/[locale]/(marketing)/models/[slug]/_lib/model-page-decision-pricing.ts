import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';

import { getPresetQuote, type VideoPriceScenario } from '../../../pricing/_lib/pricingHubData';
import type { ModelPagePricingPreset } from './model-page-template-types';

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
    maxDuration: 'Max duration',
    mostPopular: 'Most popular',
    nativeAudioIncluded: 'Native audio included',
    standardPreview: 'Standard preview',
    upTo1080p: 'Up to 1080p',
  },
  fr: {
    audio: 'Audio',
    audioExtraValue: '0 $ en plus',
    commonProductionCheck: 'Contrôle production courant',
    entryDraft: 'Brouillon d’entrée',
    maxDuration: 'Durée max',
    mostPopular: 'Populaire',
    nativeAudioIncluded: 'Audio natif inclus',
    standardPreview: 'Aperçu standard',
    upTo1080p: 'Jusqu’à 1080p',
  },
  es: {
    audio: 'Audio',
    audioExtraValue: '0 $ extra',
    commonProductionCheck: 'Revisión común de producción',
    entryDraft: 'Borrador inicial',
    maxDuration: 'Duración máxima',
    mostPopular: 'Popular',
    nativeAudioIncluded: 'Audio nativo incluido',
    standardPreview: 'Vista previa estándar',
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

function buildPricedScenarioPreset(preset: ModelPagePricingPreset): VideoPriceScenario {
  const seconds = preset.seconds ?? 10;
  const resolution = preset.resolution ?? '1080p';
  return {
    id: preset.id,
    label: `${seconds}s ${resolution}`,
    subLabel: preset.labelKey,
    resolution,
    durationSec: seconds,
    audio: false,
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
  if (preset.fixedValueKey === 'audioExtraValue') {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: getPricingLabel(locale, 'audioExtraValue'),
      note: getPricingLabel(locale, preset.noteKey ?? 'nativeAudioIncluded'),
    };
  }

  if (preset.fixedValueKey === 'maxDurationValue') {
    return {
      id: preset.id,
      label: getPricingLabel(locale, preset.labelKey),
      value: formatSeconds(getMaxDurationSeconds(entry), locale),
      note: getPricingLabel(locale, preset.noteKey ?? 'upTo1080p'),
    };
  }

  const quote = getPresetQuote(entry, buildPricedScenarioPreset(preset), locale);

  return {
    id: preset.id,
    label: getPricingLabel(locale, preset.labelKey),
    value: quote.display ?? '',
    note: quote.note ?? `${formatSeconds(preset.seconds ?? 10, locale)} · ${preset.resolution ?? '1080p'}`,
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
