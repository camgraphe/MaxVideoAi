import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '@/types/engines';

import { AgentApiError } from './errors';
import { getAgentModelGuidance, type AgentModelGuidance } from './model-guidance';
import {
  listPublicAgentGenerationEngines,
  type AgentModelCatalogDeps,
  type AgentPublicGenerationEngine,
} from './model-catalog';
import type {
  AgentGenerationMode,
  AgentModelAudioPolicy,
  AgentModelDetails,
  AgentModelDurationDetails,
  AgentModelModeDetails,
  AgentModelReferenceFieldDetails,
} from './types';

export type AgentModelDetailsDeps = AgentModelCatalogDeps & {
  getGuidance?(engineId: string): AgentModelGuidance | null;
};

function isReferenceField(
  field: EngineInputField,
): field is EngineInputField & { type: AgentModelReferenceFieldDetails['type'] } {
  return field.type === 'image' || field.type === 'video' || field.type === 'audio';
}

function applicableToMode(field: EngineInputField, mode: AgentGenerationMode): boolean {
  return !field.modes?.length || field.modes.includes(mode);
}

function projectReferences(
  engine: EngineCaps,
  mode: AgentGenerationMode,
): readonly AgentModelReferenceFieldDetails[] {
  const fields = [
    ...(engine.inputSchema?.required ?? []).map((field) => ({ field, required: true })),
    ...(engine.inputSchema?.optional ?? []).map((field) => ({ field, required: false })),
  ];
  return Object.freeze(fields.flatMap(({ field, required }) => {
    if (!isReferenceField(field) || !applicableToMode(field, mode)) return [];
    return [Object.freeze({
      id: field.id,
      type: field.type,
      required: field.requiredInModes ? field.requiredInModes.includes(mode) : required,
      min: field.minCount ?? null,
      max: field.maxCount ?? null,
    })];
  }));
}

function projectGuidance(guidance: AgentModelGuidance | null): AgentModelGuidance | null {
  if (!guidance) return null;
  return Object.freeze({
    engineId: guidance.engineId,
    strengths: Object.freeze([...guidance.strengths]),
    bestFor: Object.freeze([...guidance.bestFor]),
    considerations: Object.freeze([...guidance.considerations]),
    evidenceUrls: Object.freeze([...guidance.evidenceUrls]),
    reviewedAt: guidance.reviewedAt,
  });
}

function projectDuration(caps: EngineModeUiCaps, engine: EngineCaps): AgentModelDurationDetails | null {
  if (!caps.duration) return null;
  if ('options' in caps.duration) {
    return Object.freeze({
      options: Object.freeze([...caps.duration.options]),
      range: null,
    });
  }
  return Object.freeze({
    options: null,
    range: Object.freeze({ min: caps.duration.min, max: engine.maxDurationSec }),
  });
}

function projectAudio(caps: EngineModeUiCaps, engine: EngineCaps): AgentModelAudioPolicy {
  if (!engine.audio) return 'unavailable';
  return caps.audioToggle === true ? 'optional' : 'always_generated';
}

function projectMode(
  candidate: AgentPublicGenerationEngine,
  mode: AgentGenerationMode,
): AgentModelModeDetails {
  const caps = candidate.modeCaps[mode];
  if (!caps) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'This MaxVideoAI model is not currently available.');
  }
  const fps = caps.fps === undefined ? [] : Array.isArray(caps.fps) ? caps.fps : [caps.fps];
  return Object.freeze({
    mode,
    duration: projectDuration(caps, candidate.engine),
    resolutions: Object.freeze([...(caps.resolution ?? [])]),
    aspectRatios: Object.freeze([...(caps.aspectRatio ?? [])]),
    fps: Object.freeze([...fps]),
    audio: projectAudio(caps, candidate.engine),
    references: projectReferences(candidate.engine, mode),
  });
}

function listPublicCandidates(deps?: AgentModelDetailsDeps): Promise<readonly AgentPublicGenerationEngine[]> {
  return deps ? listPublicAgentGenerationEngines(deps) : listPublicAgentGenerationEngines();
}

export async function getAgentModelDetails(
  engineId: string,
  deps?: AgentModelDetailsDeps,
): Promise<AgentModelDetails> {
  const candidates = await listPublicCandidates(deps);
  const candidate = candidates.find((entry) => entry.engine.id === engineId);
  if (!candidate) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'This MaxVideoAI model is not currently available.');
  }

  const guidance = projectGuidance((deps?.getGuidance ?? getAgentModelGuidance)(candidate.engine.id));
  const examples = guidance?.evidenceUrls.find((url) => new URL(url).pathname.includes('/examples/')) ?? null;
  return Object.freeze({
    id: candidate.engine.id,
    label: candidate.engine.label,
    surface: candidate.surface,
    availability: candidate.engine.availability,
    modes: Object.freeze(candidate.publicModes.map((mode) => projectMode(candidate, mode))),
    guidance,
    links: Object.freeze({
      model: `https://maxvideoai.com/models/${encodeURIComponent(candidate.engine.id)}`,
      pricing: 'https://maxvideoai.com/pricing',
      examples,
    }),
    catalogUpdatedAt: candidate.engine.updatedAt,
  });
}
