import type { AppLocale } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';

import {
  getPresetQuote,
  type VideoPriceScenario,
} from '../../../pricing/_lib/pricingHubData';
import { formatCurrencyForLocale } from '../../../pricing/_lib/pricingPageContent';

const DECISION_PRICE_PRESETS = [
  { id: '5s-480p', label: '5s 480p', subLabel: 'Quick draft', resolution: '480p', durationSec: 5, audio: false },
  { id: '8s-720p', label: '8s 720p', subLabel: 'Standard', resolution: '720p', durationSec: 8, audio: false },
  { id: '10s-1080p', label: '10s 1080p', subLabel: 'Best balance', resolution: '1080p', durationSec: 10, audio: false },
  {
    id: '10s-1080p-audio',
    label: '10s + audio',
    subLabel: 'Native audio',
    resolution: '1080p',
    durationSec: 10,
    audio: true,
  },
] as const satisfies readonly VideoPriceScenario[];

type DecisionPricePresetId = (typeof DECISION_PRICE_PRESETS)[number]['id'];
type DecisionPricingScenarioId = DecisionPricePresetId | 'max-duration';

export type ModelDecisionPricingScenario = {
  id: DecisionPricingScenarioId;
  label: string;
  value: string;
  note: string;
  badge?: string;
};

const SCENARIO_COPY: Record<
  AppLocale,
  Record<DecisionPricingScenarioId, { label: string; value?: string; note: string; badge?: string }>
> = {
  en: {
    '5s-480p': { label: 'Entry draft', note: '5s · 480p' },
    '8s-720p': { label: 'Standard preview', note: '8s · 720p' },
    '10s-1080p': { label: 'Common production check', note: '10s · 1080p', badge: 'Most popular' },
    '10s-1080p-audio': { label: 'Audio', value: '$0 extra', note: 'Native audio included' },
    'max-duration': { label: 'Max duration', note: 'Up to 1080p' },
  },
  fr: {
    '5s-480p': { label: 'Brouillon d’entrée', note: '5 s · 480p' },
    '8s-720p': { label: 'Aperçu standard', note: '8 s · 720p' },
    '10s-1080p': { label: 'Contrôle production courant', note: '10 s · 1080p', badge: 'Populaire' },
    '10s-1080p-audio': { label: 'Audio', value: '0 $ en plus', note: 'Audio natif inclus' },
    'max-duration': { label: 'Durée max', note: 'Jusqu’à 1080p' },
  },
  es: {
    '5s-480p': { label: 'Borrador inicial', note: '5 s · 480p' },
    '8s-720p': { label: 'Vista previa estándar', note: '8 s · 720p' },
    '10s-1080p': { label: 'Revisión común de producción', note: '10 s · 1080p', badge: 'Popular' },
    '10s-1080p-audio': { label: 'Audio', value: '0 $ extra', note: 'Audio nativo incluido' },
    'max-duration': { label: 'Duración máxima', note: 'Hasta 1080p' },
  },
};

function formatSeconds(seconds: number, locale: AppLocale) {
  return locale === 'en' ? `${seconds}s` : `${seconds} s`;
}

function getMaxDurationSeconds(entry: FalEngineEntry) {
  return entry.engine.pricingDetails?.maxDurationSec ?? entry.engine.maxDurationSec;
}

function getCurrency(entry: FalEngineEntry) {
  return entry.engine.pricingDetails?.currency ?? entry.engine.pricing?.currency ?? 'USD';
}

function formatAudioExtraValue({
  audioCents,
  baseCents,
  entry,
  locale,
  zeroValue,
}: {
  audioCents?: number;
  baseCents?: number;
  entry: FalEngineEntry;
  locale: AppLocale;
  zeroValue?: string;
}) {
  if (typeof audioCents !== 'number' || typeof baseCents !== 'number') {
    return null;
  }

  const extraCents = Math.max(0, audioCents - baseCents);
  if (extraCents === 0) {
    return zeroValue ?? formatCurrencyForLocale(locale, getCurrency(entry), 0);
  }

  const formattedExtra = formatCurrencyForLocale(locale, getCurrency(entry), extraCents / 100);
  return locale === 'fr' ? `${formattedExtra} en plus` : `${formattedExtra} extra`;
}

export function buildDecisionPricingScenarios(
  entry: FalEngineEntry,
  locale: AppLocale
): ModelDecisionPricingScenario[] {
  const copy = SCENARIO_COPY[locale] ?? SCENARIO_COPY.en;
  const baseProductionQuote = getPresetQuote(entry, DECISION_PRICE_PRESETS[2], locale);
  const presetScenarios = DECISION_PRICE_PRESETS.map((preset) => {
    const id = preset.id;
    const quote = getPresetQuote(entry, preset, locale);
    const copiedValue =
      id === '10s-1080p-audio'
        ? formatAudioExtraValue({
            audioCents: quote.amountCents,
            baseCents: baseProductionQuote.amountCents,
            entry,
            locale,
            zeroValue: copy[id].value,
          })
        : null;
    return {
      id,
      label: copy[id].label,
      value: copiedValue ?? quote.display ?? '',
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
