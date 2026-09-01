import { listFalEngines } from '@/config/falEngines';
import { getModelRegistryEntryById } from '@/config/model-registry';
import {
  getRuntimeModelById,
  getRuntimeModelSuccessor,
  type RuntimeModelEntry,
} from '@/config/model-runtime';
import type { TransactionQueryExecutor } from '@/lib/db';
import {
  getPublicConfiguredEnginesByCategory,
  getPublicConfiguredEnginesByCategoryInExecutor,
  getConfiguredEngineIncludingHidden,
  getConfiguredEngineIncludingHiddenInExecutor,
} from '@/server/engines';
import {
  resolveAgentGenerationEngineExecutability,
  resolveAgentGenerationModeExecutability,
  isAgentGenerationEngineExecutable,
  isAgentGenerationModeExecutable,
  type AgentGenerationExecutabilityEnvironment,
} from '@/server/agent-runtime/model-executability';
import { normalizeVideoDurationOption } from '@/server/video-generation/execution-constraints';
import type { EngineCaps, EngineModeUiCaps, Mode } from '@/types/engines';

import type { AgentGenerationMode, AgentModel, AgentModelFilter } from './types';
import { toCanonicalGenerationMode, toEngineGenerationMode } from './generation-mode-aliases';
import {
  isPublicAgentEngine,
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
        .flatMap((mode) => {
          const surface = entry.category === 'image' ? 'image' : 'video';
          const canonical = toCanonicalGenerationMode(entry.id, surface, mode.mode);
          return canonical ? [[canonical, mode.ui]] : [];
        }),
    ) as Partial<Record<AgentGenerationMode, EngineModeUiCaps>>,
  ]),
);

export type AgentModelCatalogDeps = {
  listEngines(): Promise<EngineCaps[]>;
  getEngineIncludingHidden?(engineId: string): Promise<EngineCaps | undefined>;
  surfaceByEngineId(engineId: string): 'video' | 'image' | null;
  isEngineExecutable?(engine: EngineCaps): boolean;
  isModeExecutable?(engine: EngineCaps, mode: Mode): boolean;
};

export type AgentModelAccessContext = Readonly<{
  allowedPrelaunchModelIds: ReadonlySet<string>;
}>;

export type AgentModelCandidate = {
  model: AgentModel;
  latencyTier: EngineCaps['latencyTier'];
  discoveryRank: number | null;
  selectionGroup: string;
};

export type AgentPublicCatalogEngine = AgentPublicGenerationEngine & {
  generationEnabled: boolean;
};

export function createAgentModelCatalogDeps(
  environment?: AgentGenerationExecutabilityEnvironment,
): AgentModelCatalogDeps {
  return {
    listEngines: () => getPublicConfiguredEnginesByCategory('all'),
    getEngineIncludingHidden: (engineId) => getConfiguredEngineIncludingHidden(engineId),
    surfaceByEngineId(engineId) {
      return SURFACE_BY_ENGINE_ID.get(engineId) ?? null;
    },
    isEngineExecutable: environment
      ? (engine) => resolveAgentGenerationEngineExecutability(engine, environment).executable
      : isAgentGenerationEngineExecutable,
    isModeExecutable: environment
      ? (engine, mode) => resolveAgentGenerationModeExecutability(engine, mode, environment).executable
      : isAgentGenerationModeExecutable,
  };
}

const defaultDeps: AgentModelCatalogDeps = createAgentModelCatalogDeps();

function referenceImagesSupported(modes: AgentGenerationMode[]): boolean {
  return modes.some((mode) =>
    mode === 'i2v' || mode === 'i2v_standard' || mode === 'ref2v' || mode === 'fl2v' || mode === 'i2i'
  );
}

function maximumModeDurationSec(
  caps: EngineModeUiCaps,
  engineMaximumDurationSec: number,
): number | null {
  if (!caps.duration) return null;
  if (!('options' in caps.duration)) return engineMaximumDurationSec;
  const numericOptions = caps.duration.options
    .map(normalizeVideoDurationOption)
    .filter((value): value is number => typeof value === 'number');
  if (!numericOptions.length) return null;
  return Math.min(engineMaximumDurationSec, Math.max(...numericOptions));
}

function toCandidate(
  engine: EngineCaps,
  surface: 'video' | 'image',
  modes: AgentGenerationMode[],
  generationEnabled: boolean,
  scopedMode?: Readonly<{ mode: AgentGenerationMode; caps: EngineModeUiCaps }>,
): AgentModelCandidate {
  const registryEntry = getModelRegistryEntryById(engine.id);
  const runtime = getRuntimeModelById(engine.id);
  const successor = runtime
    ? getRuntimeModelSuccessor(runtime)
      ?? (runtime.publicTargetId ? getRuntimeModelById(runtime.publicTargetId) : null)
    : null;
  const aspectRatios = scopedMode ? scopedMode.caps.aspectRatio ?? [] : engine.aspectRatios;
  const resolutions = scopedMode ? scopedMode.caps.resolution ?? [] : engine.resolutions;
  const maxDurationSec = surface === 'video'
    ? scopedMode
      ? maximumModeDurationSec(scopedMode.caps, engine.maxDurationSec)
      : engine.maxDurationSec
    : null;
  return {
    model: {
      id: engine.id,
      label: engine.label,
      surface,
      modes: scopedMode ? [scopedMode.mode] : modes,
      aspectRatios: [...aspectRatios],
      resolutions: [...resolutions],
      maxDurationSec,
      audio: surface === 'video' && engine.audio,
      referenceImages: referenceImagesSupported(scopedMode ? [scopedMode.mode] : modes),
      availability: engine.availability,
      generationEnabled,
      lifecycle: runtime?.lifecycle ?? 'current',
      successor: successor ? { id: successor.id, slug: successor.slug } : null,
      recommendedByDefault: runtime?.lifecycle === undefined || runtime.lifecycle === 'current',
    },
    latencyTier: engine.latencyTier,
    discoveryRank: registryEntry?.publication.app.discoveryRank ?? null,
    selectionGroup:
      registryEntry?.family ?? registryEntry?.publication.app.variantGroup ?? engine.id,
  };
}

function isVisibleRuntimeModel(
  runtime: RuntimeModelEntry | null,
  exactId: string | undefined,
  access: AgentModelAccessContext | undefined,
  includeExecutableLegacy: boolean,
): boolean {
  if (!runtime) return true;
  if (!exactId) return runtime.publication.app.published
    && (runtime.lifecycle === 'current' || (includeExecutableLegacy && runtime.lifecycle === 'legacy'));
  if (runtime.publication.app.published) return true;
  if (runtime.lifecycle === 'deep_legacy' || runtime.lifecycle === 'retired') return true;
  return runtime.lifecycle === 'current' && access?.allowedPrelaunchModelIds.has(runtime.id) === true;
}

function isExecutableLifecycle(runtime: RuntimeModelEntry | null): boolean {
  return runtime?.lifecycle !== 'deep_legacy' && runtime?.lifecycle !== 'retired';
}

export async function listPublicAgentCatalogEngines(
  deps: AgentModelCatalogDeps = defaultDeps,
  options: Readonly<{
    exactId?: string;
    access?: AgentModelAccessContext;
    includeExecutableLegacy?: boolean;
  }> = {},
): Promise<AgentPublicCatalogEngine[]> {
  const listed = await deps.listEngines();
  const exactRuntime = options.exactId ? getRuntimeModelById(options.exactId) : null;
  const hidden = options.exactId
    && !listed.some((engine) => engine.id === options.exactId)
    && isVisibleRuntimeModel(exactRuntime, options.exactId, options.access, options.includeExecutableLegacy === true)
    ? await deps.getEngineIncludingHidden?.(options.exactId)
    : undefined;
  const engines = hidden ? [...listed, hidden] : listed;
  return engines.flatMap((engine) => {
    const runtime = getRuntimeModelById(engine.id);
    if (!isVisibleRuntimeModel(runtime, options.exactId, options.access, options.includeExecutableLegacy === true)) return [];
    const surface = deps.surfaceByEngineId(engine.id);
    if (!isPublicAgentEngine(engine, surface)) return [];
    const modes = listPublicAgentModes(engine, surface);
    const configuredModeCaps = (engine.modeCaps ?? {}) as Partial<
      Record<AgentGenerationMode, EngineModeUiCaps>
    >;
    const registryModeCaps = MODE_CAPS_BY_ENGINE_ID.get(engine.id) ?? {};
    const modeCaps = Object.fromEntries(
      modes.flatMap((mode) => {
        const engineMode = toEngineGenerationMode(engine.id, mode) as AgentGenerationMode;
        const caps = configuredModeCaps[mode] ?? configuredModeCaps[engineMode] ?? registryModeCaps[mode];
        return caps ? [[mode, caps]] : [];
      }),
    ) as AgentPublicGenerationEngine['modeCaps'];
    const configuredModes = modes.filter((mode) => Boolean(modeCaps[mode]));
    if (!configuredModes.length) return [];
    const executableModes = configuredModes.filter((mode) =>
      deps.isModeExecutable?.(engine, toEngineGenerationMode(engine.id, mode)) !== false
    );
    const generationEnabled = isExecutableLifecycle(runtime)
      && deps.isEngineExecutable?.(engine) !== false
      && executableModes.length > 0;
    return [{
      engine,
      surface,
      publicModes: generationEnabled ? executableModes : configuredModes,
      modeCaps,
      generationEnabled,
    }];
  });
}

export async function listPublicAgentGenerationEngines(
  deps: AgentModelCatalogDeps = defaultDeps,
  access?: AgentModelAccessContext,
): Promise<AgentPublicGenerationEngine[]> {
  const listedEngines = await deps.listEngines();
  const cachedDeps: AgentModelCatalogDeps = {
    ...deps,
    listEngines: async () => listedEngines,
  };
  const publicCandidates = await listPublicAgentCatalogEngines(cachedDeps, { includeExecutableLegacy: true });
  const prelaunchCandidates: AgentPublicCatalogEngine[] = [];
  for (const exactId of access?.allowedPrelaunchModelIds ?? []) {
    prelaunchCandidates.push(...await listPublicAgentCatalogEngines(cachedDeps, { exactId, access }));
  }
  const byId = new Map([...publicCandidates, ...prelaunchCandidates].map((entry) => [entry.engine.id, entry]));
  return [...byId.values()].flatMap(({ generationEnabled, ...candidate }) => generationEnabled ? [candidate] : []);
}

export async function listPublicAgentGenerationEnginesInExecutor(
  executor: TransactionQueryExecutor,
  environment?: AgentGenerationExecutabilityEnvironment,
  access?: AgentModelAccessContext,
): Promise<AgentPublicGenerationEngine[]> {
  return listPublicAgentGenerationEngines({
    listEngines: () => getPublicConfiguredEnginesByCategoryInExecutor('all', executor),
    getEngineIncludingHidden: (engineId) => getConfiguredEngineIncludingHiddenInExecutor(engineId, executor),
    surfaceByEngineId(engineId) {
      return SURFACE_BY_ENGINE_ID.get(engineId) ?? null;
    },
    isEngineExecutable: environment
      ? (engine) => resolveAgentGenerationEngineExecutability(engine, environment).executable
      : isAgentGenerationEngineExecutable,
    isModeExecutable: environment
      ? (engine, mode) => resolveAgentGenerationModeExecutability(engine, mode, environment).executable
      : isAgentGenerationModeExecutable,
  }, access);
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
  deps: AgentModelCatalogDeps = defaultDeps,
  options: Readonly<{ generationEnabledOnly?: boolean }> = {},
  access?: AgentModelAccessContext,
): Promise<AgentModelCandidate[]> {
  const engines = await listPublicAgentCatalogEngines(deps, { exactId: filter.id, access });
  return engines.flatMap(({ engine, surface, publicModes: modes, modeCaps, generationEnabled }) => {
    if (options.generationEnabledOnly && !generationEnabled) return [];
    if (filter.mode && !modes.includes(filter.mode)) return [];
    const selectedModeCaps = filter.mode ? modeCaps[filter.mode] : undefined;
    if (filter.mode && !selectedModeCaps) return [];
    const candidate = toCandidate(
      engine,
      surface,
      modes,
      generationEnabled,
      filter.mode && selectedModeCaps ? { mode: filter.mode, caps: selectedModeCaps } : undefined,
    );
    return matchesFilter(candidate.model, filter) ? [candidate] : [];
  });
}

export async function listAgentModels(
  filter: AgentModelFilter = {},
  deps: AgentModelCatalogDeps = defaultDeps
): Promise<AgentModel[]> {
  const models = (await listAgentModelCandidates(filter, deps)).map((candidate) => candidate.model);
  return filter.limit === undefined ? models : models.slice(0, filter.limit);
}
