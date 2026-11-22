export type CanonicalGenerationSurface = 'video' | 'image';

export const CANONICAL_VIDEO_GENERATION_MODES = [
  't2v',
  'i2v',
  'i2v_standard',
  'ref2v',
  'fl2v',
  'v2v',
  'r2v',
  'extend',
  'a2v',
  'retake',
  'reframe',
] as const;

export const CANONICAL_IMAGE_GENERATION_MODES = ['t2i', 'i2i'] as const;

export const CANONICAL_GENERATION_MODES = [
  ...CANONICAL_VIDEO_GENERATION_MODES,
  ...CANONICAL_IMAGE_GENERATION_MODES,
] as const;

export type CanonicalVideoGenerationMode = (typeof CANONICAL_VIDEO_GENERATION_MODES)[number];
export type CanonicalImageGenerationMode = (typeof CANONICAL_IMAGE_GENERATION_MODES)[number];
export type CanonicalGenerationMode = (typeof CANONICAL_GENERATION_MODES)[number];

const KLING_STANDARD_ENGINE_ID = 'kling-2-5-turbo';

export function toEngineGenerationMode(
  engineId: string,
  mode: CanonicalGenerationMode,
): Exclude<CanonicalGenerationMode, 'i2v_standard'> {
  if (engineId === KLING_STANDARD_ENGINE_ID && mode === 'i2v_standard') return 'i2i';
  return mode as Exclude<CanonicalGenerationMode, 'i2v_standard'>;
}

export function toCanonicalGenerationMode(
  engineId: string,
  surface: CanonicalGenerationSurface,
  mode: string,
): CanonicalGenerationMode | null {
  // Omni retake requires resolving an owned MaxVideoAI source job to its private
  // provider interaction ID. Keep it undiscoverable until that resolver exists;
  // accepting a caller-supplied provider ID would cross the account boundary.
  if (engineId === 'gemini-omni-flash' && surface === 'video' && mode === 'retake') {
    return null;
  }
  if (engineId === KLING_STANDARD_ENGINE_ID && surface === 'video' && mode === 'i2i') {
    return 'i2v_standard';
  }
  const allowed = surface === 'video' ? CANONICAL_VIDEO_GENERATION_MODES : CANONICAL_IMAGE_GENERATION_MODES;
  return allowed.includes(mode as never) ? (mode as CanonicalGenerationMode) : null;
}
