import type { AppLocale } from '@/i18n/locales';
import type { PricingContext } from '@/lib/pricing-context';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import type { Mode } from '@/types/engines';

export type ModelDecisionScenarioDetails = {
  seconds: number;
  resolution: string;
  mode: Mode;
  aspectRatio?: string;
  audio?: boolean;
  referenceImages?: number;
  referenceVideoSeconds?: number;
};

const COPY = {
  en: { on: 'Audio on', off: 'Audio off', audioUnknown: 'Check audio setting', none: 'No references',
    images: 'reference images', video: 'reference video', referencesUnknown: 'Check references',
    perVideo: 'per video', unavailable: 'Check the scenario in the live quote' },
  fr: { on: 'Audio activé', off: 'Audio désactivé', audioUnknown: 'Vérifier le réglage audio', none: 'Sans référence',
    images: 'images de référence', video: 'vidéo de référence', referencesUnknown: 'Vérifier les références',
    perVideo: 'par vidéo', unavailable: 'Vérifier le scénario dans le devis actuel' },
  es: { on: 'Audio activado', off: 'Audio desactivado', audioUnknown: 'Verifica el ajuste de audio', none: 'Sin referencias',
    images: 'imágenes de referencia', video: 'video de referencia', referencesUnknown: 'Verifica las referencias',
    perVideo: 'por video', unavailable: 'Verifica el escenario en el precio actual' },
} as const;

/** Project the canonical resolver's settings; never infer them from a preset ID. */
export function modelDecisionScenarioDetails(context: PricingContext): ModelDecisionScenarioDetails | null {
  if (!Number.isFinite(context.durationSec) || context.durationSec <= 0 || !context.resolution || !context.mode) return null;
  const audio = typeof context.addons?.audio === 'boolean' ? context.addons.audio
    : context.addons?.audio_off === true ? false : undefined;
  return {
    seconds: context.durationSec,
    resolution: context.resolution,
    mode: context.mode,
    ...(context.aspectRatio ? { aspectRatio: context.aspectRatio } : {}),
    ...(audio !== undefined ? { audio } : {}),
    ...(context.referenceImageCount !== undefined || context.inputImageCount !== undefined || context.mode === 't2v'
      ? { referenceImages: context.referenceImageCount ?? context.inputImageCount ?? 0 } : {}),
    ...(context.hasVideoInput === false ? { referenceVideoSeconds: 0 }
      : context.inputVideoDurationSec !== undefined ? { referenceVideoSeconds: context.inputVideoDurationSec } : {}),
  };
}

export function formatModelDecisionScenarioDetails(details: ModelDecisionScenarioDetails, locale: AppLocale): string {
  const copy = COPY[locale];
  const references = details.referenceImages === 0 && details.referenceVideoSeconds === 0 ? copy.none
    : [details.referenceImages ? `${details.referenceImages} ${copy.images}` : null,
      details.referenceVideoSeconds ? `${details.referenceVideoSeconds} s ${copy.video}` : null]
      .filter(Boolean).join(' + ') || copy.referencesUnknown;
  return [`${details.seconds} s`, details.resolution, getLocalizedModeLabel(details.mode, locale),
    details.aspectRatio, details.audio === true ? copy.on : details.audio === false ? copy.off : copy.audioUnknown,
    references].filter(Boolean).join(' · ');
}

export function modelDecisionScenarioCopy(locale: AppLocale) {
  return COPY[locale];
}
