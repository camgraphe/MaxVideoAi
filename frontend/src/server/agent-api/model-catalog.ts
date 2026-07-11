import { listFalEngines } from '@/config/falEngines';
import { getPublicConfiguredEnginesByCategory } from '@/server/engines';
import type { EngineCaps } from '@/types/engines';

import type { AgentGenerationMode, AgentModel, AgentModelFilter } from './types';

const PUBLIC_MODES = new Set<AgentGenerationMode>(['t2v', 'i2v', 'ref2v', 't2i', 'i2i']);
const VIDEO_MODES = new Set<AgentGenerationMode>(['t2v', 'i2v', 'ref2v']);
const IMAGE_MODES = new Set<AgentGenerationMode>(['t2i', 'i2i']);
const NON_PUBLIC_API_MARKERS = /\b(admin|internal|private|hidden|disabled|unavailable)\b/i;

const SURFACE_BY_ENGINE_ID = new Map<string, 'video' | 'image'>(
  listFalEngines().flatMap((entry) => {
    const category = entry.category ?? 'video';
    return category === 'video' || category === 'image' ? [[entry.id, category]] : [];
  })
);

export type AgentModelCatalogDeps = {
  listEngines(): Promise<EngineCaps[]>;
  surfaceByEngineId(engineId: string): 'video' | 'image' | null;
};

export type AgentModelCandidate = {
  model: AgentModel;
  latencyTier: EngineCaps['latencyTier'];
  indicativeCost: number | null;
};

const defaultDeps: AgentModelCatalogDeps = {
  listEngines: () => getPublicConfiguredEnginesByCategory('all'),
  surfaceByEngineId(engineId) {
    return SURFACE_BY_ENGINE_ID.get(engineId) ?? null;
  },
};

function publicModes(engine: EngineCaps, surface: 'video' | 'image'): AgentGenerationMode[] {
  const allowedForSurface = surface === 'video' ? VIDEO_MODES : IMAGE_MODES;
  return engine.modes.filter(
    (mode): mode is AgentGenerationMode => PUBLIC_MODES.has(mode as AgentGenerationMode) && allowedForSurface.has(mode as AgentGenerationMode)
  );
}

function isPublicEngine(engine: EngineCaps, surface: 'video' | 'image' | null): surface is 'video' | 'image' {
  if (!surface || engine.isLab || engine.status === 'maintenance') return false;
  if (engine.availability !== 'available' && engine.availability !== 'limited') return false;
  if (engine.apiAvailability && NON_PUBLIC_API_MARKERS.test(engine.apiAvailability)) return false;
  return publicModes(engine, surface).length > 0;
}

function referenceImagesSupported(modes: AgentGenerationMode[]): boolean {
  return modes.some((mode) => mode === 'i2v' || mode === 'ref2v' || mode === 'i2i');
}

function toCandidate(engine: EngineCaps, surface: 'video' | 'image'): AgentModelCandidate {
  const modes = publicModes(engine, surface);
  const rawBase = engine.pricing?.base;
  return {
    model: {
      id: engine.id,
      label: engine.label,
      surface,
      modes,
      aspectRatios: [...engine.aspectRatios],
      resolutions: [...engine.resolutions],
      maxDurationSec: surface === 'video' ? engine.maxDurationSec : null,
      audio: surface === 'video' && engine.audio,
      referenceImages: referenceImagesSupported(modes),
      availability: engine.availability,
    },
    latencyTier: engine.latencyTier,
    indicativeCost: typeof rawBase === 'number' && Number.isFinite(rawBase) ? rawBase : null,
  };
}

function matchesFilter(model: AgentModel, filter: AgentModelFilter): boolean {
  if (filter.id && model.id !== filter.id) return false;
  if (filter.surface && model.surface !== filter.surface) return false;
  if (filter.mode && !model.modes.includes(filter.mode)) return false;
  if (filter.aspectRatio && !model.aspectRatios.includes(filter.aspectRatio)) return false;
  if (filter.resolution && !model.resolutions.includes(filter.resolution)) return false;
  if (
    typeof filter.maxDurationSec === 'number' &&
    (model.maxDurationSec == null || model.maxDurationSec < filter.maxDurationSec)
  ) {
    return false;
  }
  if (typeof filter.audio === 'boolean' && model.audio !== filter.audio) return false;
  if (typeof filter.referenceImages === 'boolean' && model.referenceImages !== filter.referenceImages) return false;
  return true;
}

export async function listAgentModelCandidates(
  filter: AgentModelFilter = {},
  deps: AgentModelCatalogDeps = defaultDeps
): Promise<AgentModelCandidate[]> {
  const engines = await deps.listEngines();
  return engines.flatMap((engine) => {
    const surface = deps.surfaceByEngineId(engine.id);
    if (!isPublicEngine(engine, surface)) return [];
    const candidate = toCandidate(engine, surface);
    return matchesFilter(candidate.model, filter) ? [candidate] : [];
  });
}

export async function listAgentModels(
  filter: AgentModelFilter = {},
  deps: AgentModelCatalogDeps = defaultDeps
): Promise<AgentModel[]> {
  return (await listAgentModelCandidates(filter, deps)).map((candidate) => candidate.model);
}
