import type { AppLocale } from '@/i18n/locales';
import type { CompareSpecValues, EngineCatalogEntry } from './compare-page-types';

export function formatMaxResolution(entry: EngineCatalogEntry) {
  const resolutions = entry.engine?.resolutions ?? [];
  const numeric = resolutions
    .map((value) => {
      const match = String(value).match(/(\d+)/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null);
  if (!numeric.length) return resolutions.join(', ') || 'Data pending';
  const max = Math.max(...numeric);
  return `${max}p`;
}

export function formatDuration(entry: EngineCatalogEntry) {
  const max = entry.engine?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

export function formatAspectRatios(entry: EngineCatalogEntry) {
  const ratios = entry.engine?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

export function formatFps(entry: EngineCatalogEntry) {
  const fps = entry.engine?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

export function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

export function resolveModeSupported(entry: EngineCatalogEntry, mode: string) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode) ? 'Supported' : 'Not supported';
}

export function resolveVideoToVideoSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') && modes.includes('reframe')) return 'Supported (modify / reframe workflows)';
  if (modes.includes('v2v')) return 'Supported';
  if (modes.includes('reframe')) return 'Supported (reframe workflow)';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (extend / retake workflows)';
  }
  return 'Not supported';
}

export function resolveFirstLastSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (modes.includes('fl2v')) return 'Supported';
  if (entry.engine?.keyframes != null) return resolveStatus(entry.engine.keyframes);
  return modes.length ? 'Not supported' : 'Data pending';
}

export function resolveReferenceImageSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('ref2v') || modes.includes('r2v')) return 'Supported (multi reference stills)';
  if (modes.includes('i2v')) return 'Supported (single start image)';
  return 'Not supported';
}

export function resolveReferenceVideoSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') || modes.includes('reframe')) {
    return 'Supported (source clip for modify / reframe)';
  }
  if (modes.includes('r2v')) return 'Supported';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (source clip for extend / retake)';
  }
  return 'Not supported';
}

export function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

export function buildSpecValues(
  entry: EngineCatalogEntry,
  specs: Record<string, unknown> | undefined
): CompareSpecValues {
  return {
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(entry, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(entry, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveVideoToVideoSupport(entry)),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveFirstLastSupport(entry)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveReferenceImageSupport(entry)),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', resolveReferenceVideoSupport(entry)),
    maxResolution: resolveKeySpecValue(specs, 'maxResolution', formatMaxResolution(entry)),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(entry)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(entry)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(entry)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', 'Data pending'),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(entry.engine?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(entry.engine?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', resolveStatus(entry.features?.lipsync?.value)),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(entry.engine?.motionControls)
    ),
    watermark: 'No (MaxVideoAI)',
  };
}

export function resolveKeySpecValue(
  specs: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  if (!specs || !(key in specs)) return fallback;
  const value = (specs as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length ? value.join(' / ') : fallback;
  }
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (/^(yes|true)$/i.test(normalized)) return 'Supported';
  if (/^(no|false)$/i.test(normalized)) return 'Not supported';
  return normalized;
}

export function localizeSpecDetailValue(
  value: string,
  locale: AppLocale,
  labels: { pending: string; supported: string; notSupported: string }
): string {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (lower === 'supported') return labels.supported;
  if (lower === 'not supported') return labels.notSupported;
  if (lower === 'data pending') return labels.pending;
  if (lower.startsWith('supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.supported} (${localizeSpecDetailValue(detail, locale, labels)})`;
  }
  if (lower.startsWith('not supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.notSupported} (${localizeSpecDetailValue(detail, locale, labels)})`;
  }
  if (lower === 'prompt-based only') {
    return locale === 'fr' ? 'Via prompt uniquement' : locale === 'es' ? 'Solo mediante prompt' : normalized;
  }
  if (lower === 'single start image') {
    return locale === 'fr' ? 'une seule image de départ' : locale === 'es' ? 'una sola imagen inicial' : normalized;
  }
  if (lower === 'multi reference stills') {
    return locale === 'fr'
      ? 'plusieurs stills de référence'
      : locale === 'es'
        ? 'varios stills de referencia'
        : normalized;
  }
  if (lower === 'source clip for extend / retake') {
    return locale === 'fr'
      ? 'clip source pour extension / retake'
      : locale === 'es'
        ? 'clip fuente para extensión / retake'
        : normalized;
  }
  if (lower === 'source clip for modify / reframe') {
    return locale === 'fr'
      ? 'clip source pour modify / reframe'
      : locale === 'es'
        ? 'clip fuente para modify / reframe'
        : normalized;
  }
  if (lower === 'start + end image in i2v') {
    return locale === 'fr'
      ? 'image de départ + image de fin en image → vidéo'
      : locale === 'es'
        ? 'imagen inicial + imagen final en imagen → video'
        : normalized;
  }
  if (lower === 'reframe workflow') {
    return locale === 'fr' ? 'workflow reframe' : locale === 'es' ? 'flujo reframe' : normalized;
  }
  if (lower === 'modify / reframe workflows') {
    return locale === 'fr'
      ? 'workflows modify / reframe'
      : locale === 'es'
        ? 'flujos modify / reframe'
        : normalized;
  }
  if (lower === 'extend / retake workflows') {
    return locale === 'fr'
      ? 'workflows extension / retake'
      : locale === 'es'
        ? 'flujos de extensión / retake'
        : normalized;
  }
  if (lower === 'no (maxvideoai)') {
    return locale === 'fr' ? 'Non (MaxVideoAI)' : locale === 'es' ? 'No (MaxVideoAI)' : normalized;
  }
  if (lower === 'not listed for native 4k route') {
    return locale === 'fr'
      ? 'Non listé pour la route 4K native'
      : locale === 'es'
        ? 'No listado para la ruta 4K nativa'
        : 'Not listed for native 4K route';
  }
  return value;
}
