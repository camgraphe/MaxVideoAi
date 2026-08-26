import type { EngineCaps, EngineModeUiCaps } from '@/types/engines';

import type { AgentGenerationMode } from './types';

const PUBLIC_MODES = new Set<AgentGenerationMode>([
  't2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend', 't2i', 'i2i',
]);
const VIDEO_MODES = new Set<AgentGenerationMode>([
  't2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend',
]);
const IMAGE_MODES = new Set<AgentGenerationMode>(['t2i', 'i2i']);
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
  return engine.modes.filter(
    (mode): mode is AgentGenerationMode =>
      isPublicAgentGenerationMode(mode) && allowedForSurface.has(mode),
  );
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
