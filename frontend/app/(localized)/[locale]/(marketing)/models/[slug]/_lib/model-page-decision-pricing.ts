import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';

import {
  getPresetQuote,
  VIDEO_PRICE_PRESETS,
  type VideoPricePresetId,
} from '../../../pricing/_lib/pricingHubData';

export type ModelDecisionPricingScenario = {
  id: VideoPricePresetId | 'max-duration';
  label: string;
  value: string;
  note: string;
};

const SCENARIO_PRESET_IDS = ['5s-720p', '8s-1080p', '10s-1080p', '10s-1080p-audio'] as const satisfies readonly VideoPricePresetId[];

const SCENARIO_COPY: Record<
  AppLocale,
  Record<(typeof SCENARIO_PRESET_IDS)[number] | 'max-duration', { label: string; note: string }>
> = {
  en: {
    '5s-720p': { label: '5s - 720p', note: 'Best for quick drafts' },
    '8s-1080p': { label: '8s - 1080p', note: 'Standard quality' },
    '10s-1080p': { label: '10s - 1080p', note: 'Most common comparison' },
    '10s-1080p-audio': { label: '10s - 1080p + audio', note: 'With native audio' },
    'max-duration': { label: 'Max duration', note: 'Up to 1080p' },
  },
  fr: {
    '5s-720p': { label: '5 s - 720p', note: 'Ideal pour les brouillons rapides' },
    '8s-1080p': { label: '8 s - 1080p', note: 'Qualite standard' },
    '10s-1080p': { label: '10 s - 1080p', note: 'Comparaison la plus courante' },
    '10s-1080p-audio': { label: '10 s - 1080p + audio', note: 'Avec audio natif' },
    'max-duration': { label: 'Duree max', note: "Jusqu'a 1080p" },
  },
  es: {
    '5s-720p': { label: '5 s - 720p', note: 'Ideal para borradores rapidos' },
    '8s-1080p': { label: '8 s - 1080p', note: 'Calidad estandar' },
    '10s-1080p': { label: '10 s - 1080p', note: 'Comparacion mas comun' },
    '10s-1080p-audio': { label: '10 s - 1080p + audio', note: 'Con audio nativo' },
    'max-duration': { label: 'Duracion maxima', note: 'Hasta 1080p' },
  },
};

function formatSeconds(seconds: number, locale: AppLocale) {
  return locale === 'en' ? `${seconds}s` : `${seconds} s`;
}

function getMaxDurationSeconds(entry: FalEngineEntry) {
  return entry.engine.pricingDetails?.maxDurationSec ?? entry.engine.maxDurationSec;
}

export function buildDecisionPricingScenarios(
  entry: FalEngineEntry,
  locale: AppLocale
): ModelDecisionPricingScenario[] {
  const copy = SCENARIO_COPY[locale] ?? SCENARIO_COPY.en;
  const presetScenarios = SCENARIO_PRESET_IDS.map((id) => {
    const preset = VIDEO_PRICE_PRESETS.find((candidate) => candidate.id === id);
    if (!preset) {
      throw new Error(`Missing video price preset ${id}`);
    }
    const quote = getPresetQuote(entry, preset, locale);
    return {
      id,
      label: copy[id].label,
      value: quote.display ?? '',
      note: copy[id].note,
    };
  });
  const maxDurationSec = getMaxDurationSeconds(entry);
  return [
    ...presetScenarios,
    {
      id: 'max-duration',
      label: copy['max-duration'].label,
      value: formatSeconds(maxDurationSec, locale),
      note: copy['max-duration'].note,
    },
  ];
}
