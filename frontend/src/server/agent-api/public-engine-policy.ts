import type { EngineCaps, EngineModeUiCaps } from '@/types/engines';

import type { AgentGenerationMode } from './types';
import {
  CANONICAL_GENERATION_MODES,
  CANONICAL_IMAGE_GENERATION_MODES,
  CANONICAL_VIDEO_GENERATION_MODES,
} from './generation-types';
import { toCanonicalGenerationMode } from './generation-mode-aliases';

const PUBLIC_MODES = new Set<AgentGenerationMode>(CANONICAL_GENERATION_MODES);
const VIDEO_MODES = new Set<AgentGenerationMode>(CANONICAL_VIDEO_GENERATION_MODES);
const IMAGE_MODES = new Set<AgentGenerationMode>(CANONICAL_IMAGE_GENERATION_MODES);
const NON_PUBLIC_API_MARKERS = /\b(admin|internal|private|hidden|disabled|unavailable)\b/i;

export type AgentPublicGenerationEngine = {
  engine: EngineCaps;
  surface: 'video' | 'image';
  publicModes: AgentGenerationMode[];
  modeCaps: Partial<Record<AgentGenerationMode, EngineModeUiCaps>>;
};

export function isPublicAgentGenerationMode(mode: string): mode is AgentGenerationMode {
  return PUBLIC_MODES.has(mode as AgentGenerationMode);
}

export function listPublicAgentModes(
  engine: EngineCaps,
  surface: 'video' | 'image',
): AgentGenerationMode[] {
  const allowedForSurface = surface === 'video' ? VIDEO_MODES : IMAGE_MODES;
  return engine.modes.flatMap((mode) => {
    const canonical = toCanonicalGenerationMode(engine.id, surface, mode);
    return canonical && allowedForSurface.has(canonical) ? [canonical] : [];
  });
}

export function isPublicAgentEngine(
  engine: EngineCaps,
  surface: 'video' | 'image' | null,
): surface is 'video' | 'image' {
  if (!surface || engine.isLab || engine.status === 'maintenance') return false;
  if (engine.availability !== 'available' && engine.availability !== 'limited') return false;
  if (engine.apiAvailability && NON_PUBLIC_API_MARKERS.test(engine.apiAvailability)) return false;
  return listPublicAgentModes(engine, surface).length > 0;
}
