import type { Mode } from '@/types/engines';

import type {
  CanonicalGenerationMode,
  CanonicalGenerationSurface,
} from './generation-types';
import {
  CANONICAL_IMAGE_GENERATION_MODES,
  CANONICAL_VIDEO_GENERATION_MODES,
} from './generation-types';

const KLING_STANDARD_ENGINE_ID = 'kling-2-5-turbo';

export function toEngineGenerationMode(
  engineId: string,
  mode: CanonicalGenerationMode,
): Mode {
  if (engineId === KLING_STANDARD_ENGINE_ID && mode === 'i2v_standard') return 'i2i';
  return mode as Mode;
}

export function toCanonicalGenerationMode(
  engineId: string,
  surface: CanonicalGenerationSurface,
  mode: Mode,
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
  const allowed = surface === 'video'
    ? CANONICAL_VIDEO_GENERATION_MODES
    : CANONICAL_IMAGE_GENERATION_MODES;
  return allowed.includes(mode as never) ? mode as CanonicalGenerationMode : null;
}
