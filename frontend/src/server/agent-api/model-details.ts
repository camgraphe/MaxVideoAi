import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { isLumaRay2EngineId } from '@/lib/luma-ray2';
import {
  getAspectRatioOptions,
  getDefaultResolution,
  getImageCountConstraints,
  getResolutionOptions,
} from '@/lib/image/inputSchema';

import { AgentApiError } from './errors';
import { getAgentModelGuidance, type AgentModelGuidance } from './model-guidance';
import {
  getAgentModelPromptingSources,
  type AgentModelPromptingSource,
} from './model-prompting-sources';
import {
  listPublicAgentCatalogEngines,
  type AgentModelCatalogDeps,
  type AgentPublicCatalogEngine,
} from './model-catalog';
import type {
  AgentGenerationMode,
  AgentModelAudioPolicy,
  AgentModelDetails,
  AgentModelDurationDetails,
  AgentModelModeDetails,
  AgentModelSettingDetails,
  AgentModelReferenceFieldDetails,
} from './types';
import type { CanonicalGenerationReferenceRole } from './generation-types';
import { toEngineGenerationMode } from './generation-mode-aliases';

export type AgentModelDetailsDeps = AgentModelCatalogDeps & {
  getGuidance?(engineId: string): AgentModelGuidance | null;
  getPromptingSources?(engineId: string): readonly AgentModelPromptingSource[];
};

function isReferenceField(
  field: EngineInputField,
): field is EngineInputField & { type: AgentModelReferenceFieldDetails['type'] } {
  return field.type === 'image' || field.type === 'video' || field.type === 'audio';
}

function applicableToMode(field: EngineInputField, mode: AgentGenerationMode, engineId: string): boolean {
  return !field.modes?.length || field.modes.includes(toEngineGenerationMode(engineId, mode));
}

function canonicalRolesForReferenceField(
  fieldId: string,
  mode: AgentGenerationMode,
): readonly CanonicalGenerationReferenceRole[] {
  if (fieldId === 'mask_url') return ['mask'];
  if (fieldId === 'audio_url' && mode === 'a2v') return ['source'];
  if (fieldId === 'video_url' || fieldId === 'extension_source_videos') return ['source'];
  if (fieldId === 'video_urls') return mode === 'extend' ? ['source'] : ['reference'];
  if (fieldId === 'first_frame_url') return ['first_frame'];
  if (fieldId === 'last_frame_url' || fieldId === 'end_image_url') return ['last_frame'];
  if (fieldId === 'start_image_url') return ['first_frame'];
  if (fieldId === 'image_url') {
    if (mode === 'a2v') return ['first_frame'];
    if (mode === 'v2v' || mode === 'reframe') return ['reference'];
    if (mode === 'i2v' || mode === 'i2v_standard') return ['source', 'first_frame'];
  }
  return ['reference'];
}

function requiresOwnedReferenceAsset(
  roles: readonly CanonicalGenerationReferenceRole[],
  mode: AgentGenerationMode,
  engineId: string,
): boolean {
  return roles.includes('source') && (
    mode === 'a2v'
    || mode === 'retake'
    || mode === 'reframe'
    || (mode === 'v2v' && isLumaRay2EngineId(engineId))
  );
}

function conditionalOwnedReferenceAsset(
  roles: readonly CanonicalGenerationReferenceRole[],
  mode: AgentGenerationMode,
  engineId: string,
): AgentModelReferenceFieldDetails['assetRequiredWhen'] | null {
  return engineId === 'gpt-image-2'
    && mode === 'i2i'
    && !roles.includes('mask')
    ? Object.freeze({ setting: 'resolution' as const, values: Object.freeze(['auto']) })
    : null;
}

function projectReferenceDuration(
  engine: EngineCaps,
  field: EngineInputField,
): AgentModelReferenceFieldDetails['durationSec'] | null {
  if (field.type !== 'video' && field.type !== 'audio') return null;
  const combinedMax = field.type === 'video'
    ? engine.inputSchema?.constraints?.maxCombinedVideoDurationSec
    : engine.inputSchema?.constraints?.maxCombinedAudioDurationSec;
  if (
    typeof field.minDurationSec !== 'number'
    && typeof field.maxDurationSec !== 'number'
    && typeof combinedMax !== 'number'
  ) return null;
  return Object.freeze({
    min: typeof field.minDurationSec === 'number' ? field.minDurationSec : null,
    max: typeof field.maxDurationSec === 'number' ? field.maxDurationSec : null,
    combinedMax: typeof combinedMax === 'number' ? combinedMax : null,
  });
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
    if (!isReferenceField(field) || !applicableToMode(field, mode, engine.id)) return [];
    const roles = canonicalRolesForReferenceField(field.id, mode);
    const assetRequiredWhen = conditionalOwnedReferenceAsset(roles, mode, engine.id);
    const durationSec = projectReferenceDuration(engine, field);
    return [Object.freeze({
      type: field.type,
      roles: Object.freeze([...roles]),
      assetRequired: requiresOwnedReferenceAsset(roles, mode, engine.id) || durationSec !== null,
      ...(assetRequiredWhen ? { assetRequiredWhen } : {}),
      ...(durationSec ? { durationSec } : {}),
      required: field.requiredInModes
        ? field.requiredInModes.includes(toEngineGenerationMode(engine.id, mode))
        : required,
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

function projectPromptingSources(
  sources: readonly AgentModelPromptingSource[],
  publicModes: readonly AgentGenerationMode[],
): readonly AgentModelPromptingSource[] {
  const publicModeSet = new Set<AgentGenerationMode>(publicModes);
  return Object.freeze(sources.flatMap((source) => {
    const modes = source.modes.filter((mode) => publicModeSet.has(mode));
    if (!modes.length) return [];
    return [Object.freeze({
      id: source.id,
      kind: source.kind,
      provider: source.provider,
      title: source.title,
      url: source.url,
      modes: Object.freeze([...modes]),
      reviewedAt: source.reviewedAt,
    })];
  }));
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

const CANONICAL_SETTING_BY_FIELD_ID: Readonly<Record<string, string>> = Object.freeze({
  camera_fixed: 'cameraFixed',
  cfg_scale: 'cfgScale',
  context: 'contextSec',
  edit_depth_blur: 'editDepthBlur',
  edit_face: 'editFace',
  edit_keyframe_indexes: 'editKeyframeIndexes',
  edit_normals_augmentation: 'editNormalsAugmentation',
  edit_pose_strength: 'editPoseStrength',
  edit_strength: 'editStrength',
  edit_trajectory_sparsity: 'editTrajectorySparsity',
  enable_safety_checker: 'safetyChecker',
  enable_web_search: 'enableWebSearch',
  exr_export: 'exrExport',
  guidance_scale: 'guidanceScale',
  grid_position_x: 'reframeGridPositionX',
  grid_position_y: 'reframeGridPositionY',
  hdr: 'hdr',
  image_height: 'imageHeight',
  image_width: 'imageWidth',
  limit_generations: 'limitGenerations',
  loop: 'loop',
  mode: 'modifyStrength',
  negative_prompt: 'negativePrompt',
  output_format: 'outputFormat',
  quality: 'quality',
  retake_mode: 'retakeMode',
  seed: 'seed',
  shot_type: 'shotType',
  source_position_h_norm: 'sourcePositionHeight',
  source_position_w_norm: 'sourcePositionWidth',
  source_position_x_norm: 'sourcePositionX',
  source_position_y_norm: 'sourcePositionY',
  start_time: 'startTimeSec',
  style: 'style',
  thinking_level: 'thinkingLevel',
  watermark: 'watermark',
  x_end: 'cropEndX',
  x_start: 'cropStartX',
  y_end: 'cropEndY',
  y_start: 'cropStartY',
});

function projectSettings(
  engine: EngineCaps,
  mode: AgentGenerationMode,
): readonly AgentModelSettingDetails[] {
  const fields = [
    ...(engine.inputSchema?.required ?? []).map((field) => ({ field, required: true })),
    ...(engine.inputSchema?.optional ?? []).map((field) => ({ field, required: false })),
  ];
  return Object.freeze(fields.flatMap(({ field, required }) => {
    const key = field.id === 'mode'
      ? mode === 'extend' ? 'extendPosition' : 'modifyStrength'
      : CANONICAL_SETTING_BY_FIELD_ID[field.id];
    if (!key || isReferenceField(field) || !applicableToMode(field, mode, engine.id)) return [];
    if (!['boolean', 'number', 'text', 'enum'].includes(field.type)) return [];
    return [Object.freeze({
      key,
      type: field.type as AgentModelSettingDetails['type'],
      required: field.requiredInModes
        ? field.requiredInModes.includes(toEngineGenerationMode(engine.id, mode))
        : required,
      values: field.values?.length ? Object.freeze([...field.values]) : null,
      min: typeof field.min === 'number' ? field.min : null,
      max: typeof field.max === 'number' ? field.max : null,
      default: typeof field.default === 'string'
        || typeof field.default === 'number'
        || typeof field.default === 'boolean'
        ? field.default
        : null,
    })];
  }));
}

function projectMode(
  candidate: AgentPublicCatalogEngine,
  mode: AgentGenerationMode,
): AgentModelModeDetails {
  const caps = candidate.modeCaps[mode];
  if (!caps) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'This MaxVideoAI model is not currently available.');
  }
  const fps = caps.fps === undefined ? [] : Array.isArray(caps.fps) ? caps.fps : [caps.fps];
  const isImage = candidate.surface === 'image';
  const imageMode = mode as ImageGenerationMode;
  const imageResolutions = isImage ? getResolutionOptions(candidate.engine, imageMode) : [];
  const outputCount = isImage
    ? getImageCountConstraints(candidate.engine, imageMode)
    : { min: 1, max: 1, defaultValue: 1 };
  const sourceDerivedVideo = !isImage && (
    (isLumaRay2EngineId(candidate.engine.id) && mode === 'v2v')
    || mode === 'reframe'
    || mode === 'a2v'
  );
  const videoResolutions = caps.resolution?.length
    ? [...caps.resolution]
    : sourceDerivedVideo || !caps.resolution?.length
      ? candidate.engine.resolutions.filter((value) => value !== 'auto').slice(0, 1)
      : [];
  return Object.freeze({
    mode,
    durationPolicy: mode === 'a2v'
      ? 'source_audio'
      : mode === 'reframe' || (isLumaRay2EngineId(candidate.engine.id) && mode === 'v2v')
        ? 'source_video'
        : 'requested',
    duration: projectDuration(caps, candidate.engine),
    resolutions: Object.freeze(isImage
      ? imageResolutions.length ? imageResolutions : [getDefaultResolution(candidate.engine, imageMode)]
      : videoResolutions),
    aspectRatios: Object.freeze(isImage
      ? getAspectRatioOptions(candidate.engine, imageMode)
      : [...(caps.aspectRatio ?? [])]),
    fps: Object.freeze([...fps]),
    audio: projectAudio(caps, candidate.engine),
    outputCount: Object.freeze({
      min: outputCount.min,
      max: outputCount.max,
      default: outputCount.defaultValue,
    }),
    settings: projectSettings(candidate.engine, mode),
    references: projectReferences(candidate.engine, mode),
  });
}

function listPublicCandidates(deps?: AgentModelDetailsDeps): Promise<readonly AgentPublicCatalogEngine[]> {
  return deps ? listPublicAgentCatalogEngines(deps) : listPublicAgentCatalogEngines();
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
  const promptingSources = projectPromptingSources(
    (deps?.getPromptingSources ?? getAgentModelPromptingSources)(candidate.engine.id),
    candidate.publicModes,
  );
  const examples = guidance?.evidenceUrls.find((url) => new URL(url).pathname.includes('/examples/')) ?? null;
  return Object.freeze({
    id: candidate.engine.id,
    label: candidate.engine.label,
    surface: candidate.surface,
    availability: candidate.engine.availability,
    generationEnabled: candidate.generationEnabled,
    modes: Object.freeze(candidate.publicModes.map((mode) => projectMode(candidate, mode))),
    guidance,
    promptingSources,
    links: Object.freeze({
      model: `https://maxvideoai.com/models/${encodeURIComponent(candidate.engine.id)}`,
      pricing: 'https://maxvideoai.com/pricing',
      examples,
    }),
    catalogUpdatedAt: candidate.engine.updatedAt,
  });
}
