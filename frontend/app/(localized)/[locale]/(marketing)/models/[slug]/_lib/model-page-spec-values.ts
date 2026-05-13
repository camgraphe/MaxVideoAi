import type { FalEngineEntry } from '@/config/falEngines';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import type { EngineCaps, Mode } from '@/types/engines';
import type { KeySpecValues } from './model-page-specs-types';

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

export function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

export function resolveModeSupported(engineCaps: EngineCaps | undefined, mode: Mode | 'v2v') {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode as Mode) ? 'Supported' : 'Not supported';
}

export function resolveVideoToVideoSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') && modes.includes('reframe')) return 'Supported (modify / reframe workflows)';
  if (modes.some((mode) => String(mode) === 'v2v')) return 'Supported';
  if (modes.includes('reframe')) return 'Supported (reframe workflow)';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (extend / retake workflows)';
  }
  return 'Not supported';
}

export function resolveFirstLastSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (modes.includes('fl2v')) return 'Supported';
  if (engineCaps?.keyframes != null) return resolveStatus(engineCaps.keyframes);
  return modes.length ? 'Not supported' : 'Data pending';
}

export function resolveReferenceImageSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('ref2v') || modes.includes('r2v')) return 'Supported (multi reference stills)';
  if (modes.includes('i2v')) return 'Supported (single start image)';
  return 'Not supported';
}

export function resolveReferenceVideoSupport(engineCaps: EngineCaps | undefined) {
  const modes = engineCaps?.modes ?? [];
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

export function formatMaxResolution(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  if (!resolutions.length) return 'Data pending';
  if (resolutions.some((value) => /4k/i.test(String(value)))) return '4K';
  if (resolutions.some((value) => /2k/i.test(String(value)))) return '2K';
  const numeric = resolutions
    .map((value) => {
      const raw = String(value).toLowerCase();
      if (raw.includes('square_hd') || raw.includes('portrait_hd') || raw.includes('landscape_hd')) {
        return 720;
      }
      const matchK = raw.match(/(\d+)\s*k/);
      if (matchK) return Number(matchK[1]) * 1000;
      const matchP = raw.match(/(\d+)\s*p/);
      return matchP ? Number(matchP[1]) : null;
    })
    .filter((value): value is number => value != null);
  if (!numeric.length) return resolutions.join(' / ');
  const max = Math.max(...numeric);
  return `${max}p`;
}

export function formatDuration(engineCaps: EngineCaps | undefined) {
  const max = engineCaps?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

export function formatAspectRatios(engineCaps: EngineCaps | undefined) {
  const ratios = engineCaps?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

export function formatFps(engineCaps: EngineCaps | undefined) {
  const fps = engineCaps?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

export function formatImageResolutions(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  if (!resolutions.length) return 'Data pending';
  const tierLabels = resolutions
    .map((value) => String(value).trim())
    .filter((value) => /^\d+(?:\.\d+)?\s*k$/i.test(value))
    .map((value) => value.replace(/\s+/g, '').toUpperCase());
  if (tierLabels.length) return Array.from(new Set(tierLabels)).join(' / ');
  return resolutions.join(' / ');
}

export function formatOutputFormats(entry: FalEngineEntry) {
  const engineCaps = entry.engine;
  const fields = [...(engineCaps?.inputSchema?.required ?? []), ...(engineCaps?.inputSchema?.optional ?? [])];
  const outputFormatField = fields.find((field) => field.id === 'output_format');
  const outputFormatValues =
    outputFormatField && 'values' in outputFormatField && Array.isArray(outputFormatField.values)
      ? outputFormatField.values
      : [];
  if (outputFormatValues.length) {
    return outputFormatValues.join(' / ');
  }
  const rendersVideo =
    entry.type === 'video' ||
    (engineCaps?.modes ?? []).some((mode) =>
      ['t2v', 'i2v', 'v2v', 'ref2v', 'r2v', 'fl2v', 'extend', 'reframe', 'retake'].includes(mode)
    );
  return rendersVideo ? 'MP4' : 'Data pending';
}

export function getPricePerSecondCents(engineCaps: EngineCaps | undefined): number | null {
  const perSecond = engineCaps?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function getPricePerImageCents(engineCaps: EngineCaps | undefined): number | null {
  const flat = engineCaps?.pricingDetails?.flatCents;
  const byResolution = flat?.byResolution ? Object.values(flat.byResolution) : [];
  const cents = flat?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
  }
  return null;
}

export function formatPricePerSecond(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerSecondCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

export function formatPricePerImage(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerImageCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/image`;
  }
  return 'Data pending';
}

export function buildSpecValues(
  entry: FalEngineEntry,
  specs: Record<string, unknown> | undefined,
  pricingOverrides?: { pricePerSecond?: string | null; pricePerImage?: string | null }
): KeySpecValues {
  const engineCaps = entry.engine;
  const isImage = entry.type === 'image' || engineCaps.modes?.some((mode) => mode.endsWith('i'));
  return {
    pricePerImage: resolveKeySpecValue(
      specs,
      'pricePerImage',
      pricingOverrides?.pricePerImage ?? formatPricePerImage(engineCaps)
    ),
    pricePerSecond: resolveKeySpecValue(
      specs,
      'pricePerSecond',
      pricingOverrides?.pricePerSecond ?? formatPricePerSecond(engineCaps)
    ),
    releaseDate: resolveKeySpecValue(specs, 'releaseDate', 'Data pending'),
    textToImage: resolveKeySpecValue(specs, 'textToImage', resolveModeSupported(engineCaps, 't2i')),
    imageToImage: resolveKeySpecValue(specs, 'imageToImage', resolveModeSupported(engineCaps, 'i2i')),
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(engineCaps, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(engineCaps, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveVideoToVideoSupport(engineCaps)),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveFirstLastSupport(engineCaps)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveReferenceImageSupport(engineCaps)),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', resolveReferenceVideoSupport(engineCaps)),
    maxResolution: resolveKeySpecValue(
      specs,
      'maxResolution',
      isImage ? formatImageResolutions(engineCaps) : formatMaxResolution(engineCaps)
    ),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(engineCaps)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(engineCaps)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(engineCaps)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', formatOutputFormats(entry)),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(engineCaps?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(engineCaps?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', 'Data pending'),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(engineCaps?.motionControls)
    ),
    watermark: resolveKeySpecValue(specs, 'watermark', 'No (MaxVideoAI)'),
  };
}
