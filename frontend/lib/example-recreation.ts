import type { Mode } from '@/types/engines';

const PUBLIC_EXAMPLE_MODES: ReadonlySet<string> = new Set([
  't2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'a2v', 'extend', 'retake', 'reframe', 't2i', 'i2i',
]);

/** Expose a recorded mode token, never infer it from a prompt or a model family. */
export function publicExampleGenerationMode(value: unknown): Mode | null {
  return typeof value === 'string' && PUBLIC_EXAMPLE_MODES.has(value) ? value as Mode : null;
}

/** Public comparison contract. Prices are deliberately absent: generation always requotes. */
export type ExampleRecreationSettings = {
  durationSec: number;
  resolution: string;
  aspectRatio: string;
  audio: boolean;
  mode: 't2v';
};

export function normalizeExampleResolution(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === '2160p' ? '4k' : normalized;
}

export function publicExampleRequestedResolution(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const resolution = normalizeExampleResolution(value);
  return /^(480p|512p|540p|720p|768p|1080p|1440p|4k)$/.test(resolution) ? resolution : null;
}

export function publicExampleResolution(width?: number, height?: number): string | null {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  const shortSide = Math.min(width, height);
  if (![480, 512, 540, 720, 768, 1080, 1440, 2160].includes(shortSide)) return null;
  return shortSide === 2160 ? '4k' : `${shortSide}p`;
}

export function buildExampleRecreationHref(videoId: string, engineId: string, settings: ExampleRecreationSettings) {
  const params = new URLSearchParams({
    from: videoId, engine: engineId, remix: '1', mode: settings.mode,
    duration: String(settings.durationSec), resolution: normalizeExampleResolution(settings.resolution),
    aspect: settings.aspectRatio, audio: settings.audio ? '1' : '0',
  });
  return `/app?${params.toString()}`;
}

export function parseExampleRecreationSettings(params: URLSearchParams): ExampleRecreationSettings | null {
  const durationSec = Number(params.get('duration'));
  const resolution = normalizeExampleResolution(params.get('resolution') ?? '');
  const aspectRatio = params.get('aspect') ?? '';
  const audio = params.get('audio');
  if (params.get('remix') !== '1' || params.get('mode') !== 't2v' ||
    !Number.isInteger(durationSec) || durationSec <= 0 || durationSec > 120 ||
    !/^(480p|512p|540p|720p|768p|1080p|1440p|4k)$/.test(resolution) ||
    !/^(16:9|9:16|1:1|4:3|3:4|21:9)$/.test(aspectRatio) ||
    (audio !== '0' && audio !== '1')) return null;
  return { durationSec, resolution, aspectRatio, audio: audio === '1', mode: 't2v' };
}
