import type { EngineCaps, Mode, PreflightResponse } from '@/types/engines';
import { listActiveVideoInputFields } from '@/lib/video-input-schema';
import { getMediaExcerptLimits } from '@/lib/video-excerpt';
import type { ReferenceAsset } from './workspace-assets';

const copy = {
  en: {
    single: 'This video is {duration}s long. {engine} accepts source videos up to {limit}s. Trim it to {limit}s or less, then select the trimmed video.',
    exclusive: 'This video is {duration}s long. {engine} requires source videos shorter than {limit}s. Trim it to less than {limit}s, then select the trimmed video.',
    combined: 'The selected videos total {duration}s. {engine} accepts up to {limit}s in total. Trim or remove a clip, then select the shortened videos.',
    output: 'The source video and generated duration total {duration}s. {engine} accepts up to {limit}s combined. Trim the source video or reduce the generated duration, then try again.',
  },
  fr: {
    single: 'Cette vidéo dure {duration} s. {engine} accepte les vidéos sources de {limit} s maximum. Raccourcissez-la à {limit} s ou moins, puis sélectionnez la vidéo raccourcie.',
    exclusive: 'Cette vidéo dure {duration} s. {engine} exige une vidéo source de moins de {limit} s. Raccourcissez-la à moins de {limit} s, puis sélectionnez la vidéo raccourcie.',
    combined: 'Les vidéos sélectionnées durent {duration} s au total. {engine} accepte {limit} s maximum au total. Raccourcissez ou retirez un clip, puis sélectionnez les vidéos raccourcies.',
    output: 'La vidéo source et la durée générée totalisent {duration} s. {engine} accepte {limit} s maximum au total. Raccourcissez la vidéo source ou réduisez la durée générée, puis réessayez.',
  },
  es: {
    single: 'Este vídeo dura {duration} s. {engine} acepta vídeos de origen de hasta {limit} s. Recórtalo a {limit} s o menos y selecciona el vídeo recortado.',
    exclusive: 'Este vídeo dura {duration} s. {engine} requiere vídeos de origen de menos de {limit} s. Recórtalo a menos de {limit} s y selecciona el vídeo recortado.',
    combined: 'Los vídeos seleccionados suman {duration} s. {engine} acepta hasta {limit} s en total. Recorta o elimina un clip y selecciona los vídeos recortados.',
    output: 'El vídeo de origen y la duración generada suman {duration} s. {engine} acepta hasta {limit} s en total. Recorta el vídeo de origen o reduce la duración generada e inténtalo de nuevo.',
  },
};

function formatGuidance(kind: keyof typeof copy.en, duration: number, limit: number, locale: string, engineLabel?: string): string {
  const language = locale.startsWith('fr') ? 'fr' : locale.startsWith('es') ? 'es' : 'en';
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 3 });
  const model = engineLabel ?? ({ en: 'This model', fr: 'Ce modèle', es: 'Este modelo' }[language]);
  return copy[language][kind].replaceAll('{duration}', format.format(duration))
    .replaceAll('{limit}', format.format(limit)).replaceAll('{engine}', model);
}

export function getWorkspaceVideoDurationRejection(error: PreflightResponse['error'], locale: string): string | undefined {
  if (!error || !['video_url', 'video_urls', 'extension_source_videos', 'reference_video_urls'].includes(error.field ?? '')) return undefined;
  const { durationSec, maxDurationSec } = error;
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec)
    || typeof maxDurationSec !== 'number' || !Number.isFinite(maxDurationSec)
    || maxDurationSec <= 0 || durationSec <= maxDurationSec) return undefined;
  if (error.code === 'MEDIA_DURATION_UNSUPPORTED') return formatGuidance('single', durationSec, maxDurationSec, locale);
  if (error.code === 'MEDIA_COMBINED_DURATION_EXCEEDED') return formatGuidance('combined', durationSec, maxDurationSec, locale);
  return undefined;
}

/** Immediate guidance from known metadata; the server still verifies owned originals. */
export function getWorkspaceVideoDurationGuidance({ engine, mode, inputAssets, outputDurationSec, locale }: {
  engine: EngineCaps | null;
  mode: Mode;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  outputDurationSec: number;
  locale: string;
}): string | undefined {
  if (!engine || (mode !== 'v2v' && mode !== 'extend')) return undefined;
  const message = (kind: keyof typeof copy.en, duration: number, limit: number) =>
    formatGuidance(kind, duration, limit, locale, engine.label);
  const constraints = engine.inputSchema?.constraints;
  const exclusiveLimit = mode === 'extend' ? constraints?.extendVideoDurationExclusiveMaxSec : undefined;
  const durations = new Map<string, number>();
  for (const field of listActiveVideoInputFields(engine.inputSchema, mode)) {
    if (field.type !== 'video') continue;
    const limit = getMediaExcerptLimits(engine, mode, field.id)?.maxDurationSec;
    for (const asset of inputAssets[field.id] ?? []) {
      if (asset?.kind !== 'video' || asset.status === 'error' || typeof asset.durationSec !== 'number'
        || !Number.isFinite(asset.durationSec) || asset.durationSec <= 0) continue;
      if (field.id === 'video_url' && typeof exclusiveLimit === 'number' && exclusiveLimit > 0 && asset.durationSec >= exclusiveLimit) {
        return message('exclusive', asset.durationSec, exclusiveLimit);
      }
      if (typeof limit === 'number' && limit > 0 && asset.durationSec > limit) {
        return message('single', asset.durationSec, limit);
      }
      // Match server counting: repeated extension clips consume time in Seedance 2.5.
      const key = engine.id === 'seedance-2-5' && mode === 'extend'
        ? String(durations.size) : asset.url ?? asset.id;
      durations.set(key, asset.durationSec);
    }
  }
  const total = [...durations.values()].reduce((sum, duration) => sum + duration, 0);
  const combinedModes = constraints?.combinedDurationModes;
  const combinedLimit = constraints?.maxCombinedVideoDurationSec;
  if ((!Array.isArray(combinedModes) || combinedModes.includes(mode))
    && typeof combinedLimit === 'number' && total > combinedLimit) {
    return message('combined', total, combinedLimit);
  }
  const outputLimit = constraints?.maxSourcePlusOutputDurationSec;
  if (total > 0 && typeof outputLimit === 'number' && total + outputDurationSec > outputLimit) {
    return message('output', total + outputDurationSec, outputLimit);
  }
  return undefined;
}
