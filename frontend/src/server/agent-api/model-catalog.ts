import { listFalEngines } from '@/config/falEngines';
import type { TransactionQueryExecutor } from '@/lib/db';
import {
  getPublicConfiguredEnginesByCategory,
  getPublicConfiguredEnginesByCategoryInExecutor,
} from '@/server/engines';
import type { EngineCaps, EngineModeUiCaps } from '@/types/engines';

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
const MODE_CAPS_BY_ENGINE_ID = new Map<string, Partial<Record<AgentGenerationMode, EngineModeUiCaps>>>(
  listFalEngines().map((entry) => [
    entry.id,
    Object.fromEntries(
      entry.modes
        .filter((mode): mode is typeof mode & { mode: AgentGenerationMode } =>
          PUBLIC_MODES.has(mode.mode as AgentGenerationMode))
        .map((mode) => [mode.mode, mode.ui]),
    ) as Partial<Record<AgentGenerationMode, EngineModeUiCaps>>,
  ]),
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

export type AgentPublicGenerationEngine = {
  engine: EngineCaps;
  surface: 'video' | 'image';
  publicModes: AgentGenerationMode[];
  modeCaps: Partial<Record<AgentGenerationMode, EngineModeUiCaps>>;
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

export function isPublicAgentEngine(
  engine: EngineCaps,
  surface: 'video' | 'image' | null,
): surface is 'video' | 'image' {
  if (!surface || engine.isLab || engine.status === 'maintenance') return false;
  if (engine.availability !== 'available' && engine.availability !== 'limited') return false;
  if (engine.apiAvailability && NON_PUBLIC_API_MARKERS.test(engine.apiAvailability)) return false;
  return publicModes(engine, surface).length > 0;
}

function referenceImagesSupported(modes: AgentGenerationMode[]): boolean {
  return modes.some((mode) => mode === 'i2v' || mode === 'ref2v' || mode === 'i2i');
}

function toCandidate(
  engine: EngineCaps,
  surface: 'video' | 'image',
  modes: AgentGenerationMode[],
): AgentModelCandidate {
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

export async function listPublicAgentGenerationEngines(
  deps: AgentModelCatalogDeps = defaultDeps,
): Promise<AgentPublicGenerationEngine[]> {
  const engines = await deps.listEngines();
  return engines.flatMap((engine) => {
    const surface = deps.surfaceByEngineId(engine.id);
    if (!isPublicAgentEngine(engine, surface)) return [];
    const modes = publicModes(engine, surface);
    const configuredModeCaps = engine.modeCaps ?? {};
    const registryModeCaps = MODE_CAPS_BY_ENGINE_ID.get(engine.id) ?? {};
    const modeCaps = Object.fromEntries(
      modes.flatMap((mode) => {
        const caps = configuredModeCaps[mode] ?? registryModeCaps[mode];
        return caps ? [[mode, caps]] : [];
      }),
    ) as AgentPublicGenerationEngine['modeCaps'];
    const executableModes = modes.filter((mode) => Boolean(modeCaps[mode]));
    if (!executableModes.length) return [];
    return [{
      engine,
      surface,
      publicModes: executableModes,
      modeCaps,
    }];
  });
}

export async function listPublicAgentGenerationEnginesInExecutor(
  executor: TransactionQueryExecutor,
): Promise<AgentPublicGenerationEngine[]> {
  return listPublicAgentGenerationEngines({
    listEngines: () => getPublicConfiguredEnginesByCategoryInExecutor('all', executor),
    surfaceByEngineId(engineId) {
      return SURFACE_BY_ENGINE_ID.get(engineId) ?? null;
    },
  });
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
  const engines = await listPublicAgentGenerationEngines(deps);
  return engines.flatMap(({ engine, surface, publicModes: modes }) => {
    const candidate = toCandidate(engine, surface, modes);
    return matchesFilter(candidate.model, filter) ? [candidate] : [];
  });
}

export async function listAgentModels(
  filter: AgentModelFilter = {},
  deps: AgentModelCatalogDeps = defaultDeps
): Promise<AgentModel[]> {
  return (await listAgentModelCandidates(filter, deps)).map((candidate) => candidate.model);
}
