import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';

import {
  getPresetQuote,
  type VideoPriceScenario,
} from '../../../pricing/_lib/pricingHubData';

const DECISION_PRICE_PRESETS = [
  { id: '5s-480p', label: '5s 480p', subLabel: 'Quick draft', resolution: '480p', durationSec: 5, audio: false },
  { id: '8s-720p', label: '8s 720p', subLabel: 'Standard', resolution: '720p', durationSec: 8, audio: false },
  { id: '10s-1080p', label: '10s 1080p', subLabel: 'Best balance', resolution: '1080p', durationSec: 10, audio: false },
  {
    id: '10s-1080p-audio',
    label: '10s + audio',
    subLabel: 'Narrative',
    resolution: '1080p',
    durationSec: 10,
    audio: true,
  },
] as const satisfies readonly VideoPriceScenario[];

type DecisionPricePresetId = (typeof DECISION_PRICE_PRESETS)[number]['id'];

export type ModelDecisionPricingScenario = {
  id: DecisionPricePresetId | 'max-duration';
  label: string;
  value: string;
  note: string;
  badge?: string;
};

const SCENARIO_COPY: Record<
  AppLocale,
  Record<DecisionPricePresetId | 'max-duration', { label: string; note: string; badge?: string }>
> = {
  en: {
    '5s-480p': { label: '5s - 480p', note: 'Best for quick drafts' },
    '8s-720p': { label: '8s - 720p', note: 'Standard quality' },
    '10s-1080p': { label: '10s - 1080p', note: 'Best balance', badge: 'Most popular' },
    '10s-1080p-audio': { label: '10s - 1080p + audio', note: 'With native audio' },
    'max-duration': { label: 'Max duration', note: 'Up to 1080p' },
  },
  fr: {
    '5s-480p': { label: '5 s - 480p', note: 'Ideal pour les brouillons rapides' },
    '8s-720p': { label: '8 s - 720p', note: 'Qualite standard' },
    '10s-1080p': { label: '10 s - 1080p', note: 'Meilleur equilibre', badge: 'Populaire' },
    '10s-1080p-audio': { label: '10 s - 1080p + audio', note: 'Avec audio natif' },
    'max-duration': { label: 'Duree max', note: "Jusqu'a 1080p" },
  },
  es: {
    '5s-480p': { label: '5 s - 480p', note: 'Ideal para borradores rapidos' },
    '8s-720p': { label: '8 s - 720p', note: 'Calidad estandar' },
    '10s-1080p': { label: '10 s - 1080p', note: 'Mejor equilibrio', badge: 'Popular' },
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
  const presetScenarios = DECISION_PRICE_PRESETS.map((preset) => {
    const id = preset.id;
    const quote = getPresetQuote(entry, preset, locale);
    return {
      id,
      label: copy[id].label,
      value: quote.display ?? '',
      note: copy[id].note,
      badge: copy[id].badge,
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
