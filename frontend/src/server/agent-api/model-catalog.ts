import { listFalEngines } from '@/config/falEngines';
import type { TransactionQueryExecutor } from '@/lib/db';
import {
  getPublicConfiguredEnginesByCategory,
  getPublicConfiguredEnginesByCategoryInExecutor,
} from '@/server/engines';
import { isAgentGenerationEngineExecutable } from '@/server/agent-runtime/model-executability';
import type { EngineCaps, EngineModeUiCaps } from '@/types/engines';

import type { AgentGenerationMode, AgentModel, AgentModelFilter } from './types';
import {
  isPublicAgentEngine,
  isPublicAgentGenerationMode,
  listPublicAgentModes,
  type AgentPublicGenerationEngine,
} from './public-engine-policy';

export type { AgentPublicGenerationEngine } from './public-engine-policy';
export { isAgentGenerationEngineExecutable } from '@/server/agent-runtime/model-executability';

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
          isPublicAgentGenerationMode(mode.mode))
        .map((mode) => [mode.mode, mode.ui]),
    ) as Partial<Record<AgentGenerationMode, EngineModeUiCaps>>,
  ]),
);

export type AgentModelCatalogDeps = {
  listEngines(): Promise<EngineCaps[]>;
  surfaceByEngineId(engineId: string): 'video' | 'image' | null;
  isEngineExecutable?(engine: EngineCaps): boolean;
};

export type AgentModelCandidate = {
  model: AgentModel;
  latencyTier: EngineCaps['latencyTier'];
};

const defaultDeps: AgentModelCatalogDeps = {
  listEngines: () => getPublicConfiguredEnginesByCategory('all'),
  surfaceByEngineId(engineId) {
    return SURFACE_BY_ENGINE_ID.get(engineId) ?? null;
  },
  isEngineExecutable: isAgentGenerationEngineExecutable,
};

function referenceImagesSupported(modes: AgentGenerationMode[]): boolean {
  return modes.some((mode) => mode === 'i2v' || mode === 'ref2v' || mode === 'i2i');
}

function toCandidate(
  engine: EngineCaps,
  surface: 'video' | 'image',
  modes: AgentGenerationMode[],
): AgentModelCandidate {
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
  };
}

export async function listPublicAgentGenerationEngines(
  deps: AgentModelCatalogDeps = defaultDeps,
): Promise<AgentPublicGenerationEngine[]> {
  const engines = await deps.listEngines();
  return engines.flatMap((engine) => {
    const surface = deps.surfaceByEngineId(engine.id);
    if (!isPublicAgentEngine(engine, surface) || deps.isEngineExecutable?.(engine) === false) return [];
    const modes = listPublicAgentModes(engine, surface);
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
    isEngineExecutable: isAgentGenerationEngineExecutable,
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
