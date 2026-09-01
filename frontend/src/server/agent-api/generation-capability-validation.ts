import {
  canonicalizeImageFieldValue,
  getImageCountConstraints,
  getImageFieldValues,
  getImageInputField,
  getReferenceConstraints,
  resolveRequestedAspectRatio,
  resolveRequestedResolution,
} from '@/lib/image/inputSchema';
import type { EngineInputField, EngineModeUiCaps } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { isLumaRay2EngineId } from '@/lib/luma-ray2';
import { validateGptImage2CustomImageSize } from '@/lib/image/gptImage2';
import { SEEDREAM_MAX_IMAGE_SET_IMAGES } from '@/lib/image/seedream';
import {
  isVideoDurationSupported,
  validateProviderControls,
  validateProviderSpecificConstraints,
} from '@/server/video-generation/execution-constraints';

import type {
  CanonicalGenerationReference,
  CanonicalGenerationRequest,
  CanonicalReferenceMediaKind,
} from './generation-types';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type { ResolvedReference } from './reference-types';
import { toEngineGenerationMode } from './generation-mode-aliases';
import {
  getVideoSchemaControlConstraintViolation,
  projectVideoProviderFieldValue,
} from '@/lib/video-input-schema';

const VIDEO_FIELD_BY_SETTING: Record<string, string> = {
  cameraFixed: 'camera_fixed',
  cfgScale: 'cfg_scale',
  contextSec: 'context',
  cropEndX: 'x_end',
  cropEndY: 'y_end',
  cropStartX: 'x_start',
  cropStartY: 'y_start',
  editDepthBlur: 'edit_depth_blur',
  editFace: 'edit_face',
  editKeyframeIndexes: 'edit_keyframe_indexes',
  editNormalsAugmentation: 'edit_normals_augmentation',
  editPoseStrength: 'edit_pose_strength',
  editStrength: 'edit_strength',
  editTrajectorySparsity: 'edit_trajectory_sparsity',
  exrExport: 'exr_export',
  extendPosition: 'mode',
  guidanceScale: 'guidance_scale',
  hdr: 'hdr',
  modifyStrength: 'mode',
  negativePrompt: 'negative_prompt',
  reframeGridPositionX: 'grid_position_x',
  reframeGridPositionY: 'grid_position_y',
  retakeMode: 'retake_mode',
  safetyChecker: 'enable_safety_checker',
  seed: 'seed',
  shotType: 'shot_type',
  sourcePositionHeight: 'source_position_h_norm',
  sourcePositionWidth: 'source_position_w_norm',
  sourcePositionX: 'source_position_x_norm',
  sourcePositionY: 'source_position_y_norm',
  startTimeSec: 'start_time',
};
const IMAGE_FIELD_BY_SETTING: Record<string, string> = {
  enableWebSearch: 'enable_web_search',
  imageHeight: 'image_height',
  imageWidth: 'image_width',
  limitGenerations: 'limit_generations',
  outputFormat: 'output_format',
  quality: 'quality',
  seed: 'seed',
  style: 'style',
  thinkingLevel: 'thinking_level',
  watermark: 'watermark',
};

export class GenerationCapabilityError extends Error {
  constructor(
    readonly field: string,
    readonly kind: 'parameter_invalid' | 'reference_required' | 'reference_invalid' = 'parameter_invalid',
  ) {
    super('The canonical generation request is not executable by this public model mode.');
    this.name = 'GenerationCapabilityError';
  }
}

function fail(
  field: string,
  kind: GenerationCapabilityError['kind'] = 'parameter_invalid',
): never {
  throw new GenerationCapabilityError(field, kind);
}

function applicableField(
  candidate: AgentPublicGenerationEngine,
  fieldId: string,
  mode: CanonicalGenerationRequest['mode'],
): EngineInputField | null {
  const engineMode = toEngineGenerationMode(candidate.engine.id, mode);
  const fields = [
    ...(candidate.engine.inputSchema?.required ?? []),
    ...(candidate.engine.inputSchema?.optional ?? []),
  ];
  return fields.find((field) =>
    field.id === fieldId
    && (!field.modes?.length || field.modes.includes(engineMode))) ?? null;
}

function validateFieldValue(field: EngineInputField, value: unknown): void {
  if (field.type === 'boolean') {
    if (typeof value !== 'boolean') fail(field.id);
    return;
  }
  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(field.id);
    if (typeof field.min === 'number' && value < field.min) fail(field.id);
    if (typeof field.max === 'number' && value > field.max) fail(field.id);
    if (
      typeof field.step === 'number'
      && field.step > 0
      && typeof field.min === 'number'
      && Math.abs((value - field.min) / field.step - Math.round((value - field.min) / field.step)) > 1e-9
    ) {
      fail(field.id);
    }
    return;
  }
  if (field.type === 'text') {
    if (typeof value !== 'string' || !value.length) fail(field.id);
    return;
  }
  if (field.type === 'enum') {
    if (
      (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
      || (field.values?.length && !field.values.some((allowed) => String(allowed) === String(value)))
    ) {
      fail(field.id);
    }
    return;
  }
  fail(field.id);
}

function validateVideoModeCaps(
  request: CanonicalGenerationRequest,
  caps: EngineModeUiCaps,
  candidate: AgentPublicGenerationEngine,
): void {
  const duration = request.settings.durationSec;
  if (!Number.isSafeInteger(duration) || (duration as number) < 1) fail('durationSec');
  if (caps.frames) fail('durationSec');
  if (caps.duration && !isVideoDurationSupported(duration, caps.duration, candidate.engine.maxDurationSec)) {
    fail('durationSec');
  }
  if (!caps.duration && (duration as number) > candidate.engine.maxDurationSec) fail('durationSec');
  const durationField = applicableField(candidate, 'duration', request.mode);
  if (durationField) {
    if (durationField.type === 'enum') {
      if (
        !durationField.values?.length
        || !isVideoDurationSupported(duration, { options: durationField.values })
      ) fail('durationSec');
    } else if (durationField.type === 'number') {
      validateFieldValue(durationField, duration);
    } else fail('durationSec');
  }

  const resolution = request.settings.resolution;
  const resolutionField = applicableField(candidate, 'resolution', request.mode);
  const providerResolution = projectVideoProviderFieldValue(
    resolutionField,
    resolution,
    candidate.engine.inputSchema,
  );
  const supportedResolutions = caps.resolution?.length
    ? caps.resolution
    : candidate.engine.resolutions.filter((value) => value !== 'auto').slice(0, 1);
  if (
    typeof resolution !== 'string'
    || (!supportedResolutions.includes(resolution as never)
      && !supportedResolutions.some((value) => String(value) === String(providerResolution)))
    || (!resolutionField && !candidate.engine.resolutions.includes(resolution as never))
  ) {
    fail('resolution');
  }
  const aspectRatio = request.settings.aspectRatio;
  const aspectRatioField = applicableField(candidate, 'aspect_ratio', request.mode);
  const providerAspectRatio = projectVideoProviderFieldValue(
    aspectRatioField,
    aspectRatio,
    candidate.engine.inputSchema,
  );
  const supportedAspectRatios = caps.aspectRatio ?? [];
  if (supportedAspectRatios.length > 0 && (
    typeof aspectRatio !== 'string'
    || (!supportedAspectRatios.includes(aspectRatio)
      && !supportedAspectRatios.some((value) => String(value) === String(providerAspectRatio)))
    || (!aspectRatioField && !candidate.engine.aspectRatios.includes(aspectRatio as never))
  )) {
    fail('aspectRatio');
  }
  if (supportedAspectRatios.length === 0 && aspectRatio !== undefined) {
    fail('aspectRatio');
  }
  const fps = request.settings.fps;
  if (fps !== undefined) {
    const allowed = Array.isArray(caps.fps) ? caps.fps : typeof caps.fps === 'number' ? [caps.fps] : [];
    if (!Number.isSafeInteger(fps) || !allowed.includes(fps as number)) fail('fps');
  }
  const audio = request.settings.audio;
  if (audio !== undefined && (typeof audio !== 'boolean' || !caps.audioToggle)) fail('audio');

  for (const [setting, fieldIds] of [
    ['resolution', ['resolution']],
    ['aspectRatio', ['aspect_ratio']],
    ['fps', ['fps']],
    ['audio', ['generate_audio', 'audio']],
  ] as const) {
    const value = request.settings[setting];
    const field = fieldIds
      .map((fieldId) => applicableField(candidate, fieldId, request.mode))
      .find((candidateField): candidateField is EngineInputField => Boolean(candidateField));
    if (value !== undefined && field) {
      validateFieldValue(field, projectVideoProviderFieldValue(field, value, candidate.engine.inputSchema));
    }
  }

  for (const [setting, fieldId] of Object.entries(VIDEO_FIELD_BY_SETTING)) {
    const value = request.settings[setting];
    if (value === undefined) continue;
    const field = applicableField(candidate, fieldId, request.mode);
    if (!field) fail(setting);
    validateFieldValue(field, value);
  }
  if (request.settings.loop !== undefined) {
    const field = applicableField(candidate, 'loop', request.mode);
    if (!field) fail('loop');
    validateFieldValue(field, request.settings.loop);
  }
  if (request.settings.numFrames !== undefined) fail('numFrames');

  if (getVideoSchemaControlConstraintViolation({
    inputSchema: candidate.engine.inputSchema,
    duration,
    resolution,
    fps,
  })) fail('durationSec');
}

function validateDerivedSourceFacts(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (
    request.engineId === 'gpt-image-2'
    && request.mode === 'i2i'
    && request.settings.resolution === 'auto'
    && options.resolvedReferences
  ) {
    for (const reference of request.references) {
      if (reference.role === 'mask') continue;
      if (reference.kind !== 'asset') fail('references', 'reference_invalid');
      const resolved = options.resolvedReferences.find((candidate) =>
        candidate.assetId === reference.assetId
        && candidate.role === reference.role
        && candidate.slot === reference.slot);
      if (!resolved || typeof resolved.width !== 'number' || typeof resolved.height !== 'number') {
        fail('references', 'reference_invalid');
      }
    }
  }
  if (request.mode === 'a2v' || request.mode === 'retake' || request.mode === 'reframe') {
    const source = request.references.find((reference) => reference.role === 'source');
    if (!source || source.kind !== 'asset') fail('references', 'reference_invalid');
    if (options.resolvedReferences) {
      const resolved = options.resolvedReferences.find((reference) =>
        reference.assetId === source.assetId
        && reference.role === source.role
        && reference.slot === source.slot);
      const expectedKind = request.mode === 'a2v' ? 'audio' : 'video';
      if (
        !resolved
        || resolved.mediaKind !== expectedKind
        || typeof resolved.durationSec !== 'number'
      ) fail('references', 'reference_invalid');
      if (
        (request.mode === 'a2v' || request.mode === 'reframe')
        && request.settings.durationSec !== Math.max(1, Math.ceil(resolved.durationSec))
      ) fail('durationSec');
      if (request.mode === 'retake') {
        const startTimeSec = request.settings.startTimeSec;
        if (
          typeof startTimeSec !== 'number'
          || startTimeSec + Number(request.settings.durationSec) > resolved.durationSec + 0.01
        ) fail('startTimeSec');
      }
    }
  }
  if (!isLumaRay2EngineId(request.engineId) || request.mode !== 'v2v') return;
  const source = request.references.find((reference) => reference.role === 'source');
  if (!source || source.kind !== 'asset') fail('references', 'reference_invalid');
  if (!options.resolvedReferences) return;
  const resolved = options.resolvedReferences?.find((reference) =>
    reference.assetId === source.assetId
    && reference.role === source.role
    && reference.slot === source.slot);
  if (!resolved || resolved.mediaKind !== 'video' || typeof resolved.durationSec !== 'number') {
    fail('references', 'reference_invalid');
  }
  if (request.settings.durationSec !== Math.max(1, Math.ceil(resolved.durationSec))) {
    fail('durationSec');
  }
  const fixedResolution = candidate.engine.resolutions.find((value) => value !== 'auto');
  if (fixedResolution && request.settings.resolution !== fixedResolution) fail('resolution');
}

function buildProviderConstraintPayload(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    prompt: request.prompt,
    duration: request.settings.durationSec,
    resolution: request.settings.resolution,
  };
  if (request.settings.aspectRatio !== undefined) {
    payload.aspect_ratio = request.settings.aspectRatio;
  }
  if (request.settings.loop !== undefined) payload.loop = request.settings.loop;
  if (request.settings.seed !== undefined) payload.seed = request.settings.seed;
  if (request.settings.safetyChecker !== undefined) {
    payload.enable_safety_checker = request.settings.safetyChecker;
  }
  for (const [setting, fieldId] of Object.entries(VIDEO_FIELD_BY_SETTING)) {
    const value = request.settings[setting];
    if (value !== undefined) payload[fieldId] = value;
  }
  const valuesByField = new Map<string, string[]>();
  for (const [index, reference] of request.references.entries()) {
    const fields = fieldsForReference(
      request,
      candidate,
      reference,
      resolvedMediaKind(reference, options),
    );
    const field = fields[0];
    if (!field) continue;
    const values = valuesByField.get(field.id) ?? [];
    values.push(`mcp-${reference.role}-${index + 1}`);
    valuesByField.set(field.id, values);
  }
  for (const [fieldId, values] of valuesByField) {
    const field = applicableField(candidate, fieldId, request.mode);
    payload[fieldId] = (field?.maxCount ?? 1) > 1 ? values : values[0];
  }
  return payload;
}

function validateVideoExecutionConstraints(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  const payload = buildProviderConstraintPayload(request, candidate, options);
  const provider = validateProviderSpecificConstraints({
    engineId: request.engineId,
    normalizedMode: toEngineGenerationMode(request.engineId, request.mode),
    payload,
  });
  if (!provider.ok) fail(provider.error.field ?? 'settings');
  const controls = validateProviderControls(payload);
  if (!controls.ok) fail(controls.error.field ?? 'settings');
}

function validateImageSettings(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
): void {
  const mode = request.mode as ImageGenerationMode;
  const resolution = request.settings.resolution;
  if (
    typeof resolution !== 'string'
    || !resolveRequestedResolution(candidate.engine, mode, resolution).ok
  ) {
    fail('resolution');
  }
  const aspectRatio = request.settings.aspectRatio;
  if (
    aspectRatio !== undefined
    && (typeof aspectRatio !== 'string'
      || !resolveRequestedAspectRatio(candidate.engine, mode, aspectRatio).ok)
  ) {
    fail('aspectRatio');
  }
  const counts = getImageCountConstraints(candidate.engine, mode);
  if (request.outputCount < counts.min || request.outputCount > counts.max) fail('outputCount');

  for (const [setting, fieldId] of Object.entries(IMAGE_FIELD_BY_SETTING)) {
    const value = request.settings[setting];
    if (value === undefined) continue;
    const field = getImageInputField(candidate.engine, fieldId, mode);
    if (!field) fail(setting);
    if (field.type === 'enum') {
      const values = getImageFieldValues(candidate.engine, fieldId, mode);
      if (typeof value !== 'string' || !canonicalizeImageFieldValue(values, value)) fail(setting);
    } else {
      validateFieldValue(field, value);
    }
  }
  const hasCustomWidth = request.settings.imageWidth !== undefined;
  const hasCustomHeight = request.settings.imageHeight !== undefined;
  if (resolution === 'custom') {
    const customSize = validateGptImage2CustomImageSize({
      width: request.settings.imageWidth,
      height: request.settings.imageHeight,
    });
    if (!customSize.ok) fail(!hasCustomWidth ? 'imageWidth' : 'imageHeight');
  } else if (hasCustomWidth || hasCustomHeight) {
    fail(hasCustomWidth ? 'imageWidth' : 'imageHeight');
  }
}

export type GenerationCapabilityValidationOptions = {
  resolvedReferences?: readonly ResolvedReference[];
};

const REFERENCE_FIELD_TYPES = new Set<EngineInputField['type']>(['image', 'video', 'audio']);

function fieldIdsForRole(
  request: CanonicalGenerationRequest,
  role: CanonicalGenerationReference['role'],
): readonly string[] {
  if (request.mode === 'i2v' || request.mode === 'i2v_standard') {
    if (role === 'source') return ['image_url'];
    if (role === 'first_frame') return ['first_frame_url', 'start_image_url', 'image_url'];
    if (role === 'last_frame') return ['end_image_url', 'last_frame_url'];
    return ['image_urls', 'reference_image_urls'];
  }
  if (request.mode === 'ref2v') {
    if (role === 'first_frame') return ['start_image_url', 'image_url'];
    if (role === 'last_frame') return ['end_image_url'];
    return role === 'reference'
      ? [
        'image_urls',
        'reference_images',
        'reference_image_urls',
        'video_urls',
        'reference_video_urls',
        'audio_urls',
        'reference_audio_urls',
      ]
      : [];
  }
  if (request.mode === 'fl2v') {
    if (role === 'first_frame') return ['first_frame_url', 'start_image_url'];
    if (role === 'last_frame') return ['last_frame_url', 'end_image_url'];
    return [];
  }
  if (request.mode === 'v2v') {
    if (role === 'source') return ['video_url'];
    if (role === 'first_frame') return ['start_image_url'];
    return role === 'reference'
      ? [
        'image_url',
        'edit_keyframe_urls',
        'image_urls',
        'reference_image_urls',
        'audio_urls',
        'reference_audio_urls',
      ]
      : [];
  }
  if (request.mode === 'r2v') {
    return role === 'reference' ? ['video_urls'] : [];
  }
  if (request.mode === 'extend') {
    return role === 'source' ? ['extension_source_videos', 'video_urls', 'video_url'] : [];
  }
  if (request.mode === 'a2v') {
    if (role === 'source') return ['audio_url'];
    if (role === 'first_frame') return ['image_url'];
    return [];
  }
  if (request.mode === 'retake') {
    return role === 'source' ? ['video_url'] : [];
  }
  if (request.mode === 'reframe') {
    if (role === 'source') return ['video_url'];
    return role === 'reference' ? ['image_url'] : [];
  }
  if (request.mode === 'i2i') {
    if (role === 'mask') return ['mask_url'];
    return role === 'source' || role === 'reference'
      ? ['image_urls', 'reference_image_urls']
      : [];
  }
  if (role === 'source' || role === 'first_frame') return ['start_image_url'];
  if (role === 'last_frame') return ['end_image_url'];
  return ['image_urls', 'reference_image_urls'];
}

function fieldsForReference(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  reference: CanonicalGenerationReference,
  mediaKind: CanonicalReferenceMediaKind | null,
): EngineInputField[] {
  const byKind = new Map<CanonicalReferenceMediaKind, EngineInputField>();
  for (const fieldId of fieldIdsForRole(request, reference.role)) {
    const field = applicableField(candidate, fieldId, request.mode);
    if (!field || !REFERENCE_FIELD_TYPES.has(field.type)) continue;
    const kind = field.type as CanonicalReferenceMediaKind;
    if (!byKind.has(kind)) byKind.set(kind, field);
  }
  return mediaKind ? [byKind.get(mediaKind)].filter((field): field is EngineInputField => Boolean(field)) : [...byKind.values()];
}

function resolvedMediaKind(
  reference: CanonicalGenerationReference,
  options: GenerationCapabilityValidationOptions,
): CanonicalReferenceMediaKind | null {
  if (reference.kind === 'https') return reference.mediaKind;
  if (!options.resolvedReferences) return null;
  const resolved = options.resolvedReferences.find((candidate) =>
    candidate.assetId === reference.assetId
    && candidate.role === reference.role
    && candidate.slot === reference.slot);
  if (!resolved) fail('references', 'reference_invalid');
  return resolved.mediaKind;
}

function resolvedReference(
  reference: CanonicalGenerationReference,
  options: GenerationCapabilityValidationOptions,
): ResolvedReference | null {
  if (reference.kind !== 'asset' || !options.resolvedReferences) return null;
  return options.resolvedReferences.find((candidate) =>
    candidate.assetId === reference.assetId
    && candidate.role === reference.role
    && candidate.slot === reference.slot) ?? null;
}

function validateTrustedReferenceDuration(
  reference: CanonicalGenerationReference,
  fields: readonly EngineInputField[],
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (fields.length !== 1) return;
  const field = fields[0]!;
  const constraints = candidate.engine.inputSchema?.constraints;
  const combinedLimit = field.type === 'video'
    ? constraints?.maxCombinedVideoDurationSec
    : field.type === 'audio'
      ? constraints?.maxCombinedAudioDurationSec
      : undefined;
  const exclusiveMaximum =
    requestModeForExclusiveDuration(candidate, field);
  if (
    field.minDurationSec === undefined
    && field.maxDurationSec === undefined
    && combinedLimit === undefined
    && exclusiveMaximum === undefined
  ) return;
  if (reference.kind !== 'asset') return;
  if (!options.resolvedReferences) return;
  const resolved = resolvedReference(reference, options);
  if (!resolved) fail('references', 'reference_invalid');
  const durationSec = resolved.durationSec;
  if (
    typeof durationSec !== 'number'
    || !Number.isFinite(durationSec)
    || durationSec <= 0
    || (typeof field.minDurationSec === 'number' && durationSec < field.minDurationSec)
    || (typeof field.maxDurationSec === 'number' && durationSec > field.maxDurationSec)
    || (typeof exclusiveMaximum === 'number' && durationSec >= exclusiveMaximum)
  ) fail('references', 'reference_invalid');
}

function requestModeForExclusiveDuration(
  candidate: AgentPublicGenerationEngine,
  field: EngineInputField,
): number | undefined {
  if (field.id !== 'video_url') return undefined;
  const value = candidate.engine.inputSchema?.constraints?.extendVideoDurationExclusiveMaxSec;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function validateCombinedReferenceDurations(
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (!options.resolvedReferences) return;
  const constraints = candidate.engine.inputSchema?.constraints;
  const limits = {
    video: constraints?.maxCombinedVideoDurationSec,
    audio: constraints?.maxCombinedAudioDurationSec,
  } as const;
  for (const kind of ['video', 'audio'] as const) {
    const limit = limits[kind];
    if (typeof limit !== 'number' || !Number.isFinite(limit)) continue;
    const durations = new Map<string, number>();
    for (const resolved of options.resolvedReferences) {
      if (resolved.mediaKind !== kind) continue;
      if (
        typeof resolved.durationSec !== 'number'
        || !Number.isFinite(resolved.durationSec)
        || resolved.durationSec <= 0
      ) fail('references', 'reference_invalid');
      durations.set(resolved.storageUrl, resolved.durationSec);
    }
    const total = [...durations.values()].reduce((sum, durationSec) => sum + durationSec, 0);
    if (total > limit) fail('references', 'reference_invalid');
  }
}

function referenceSourceIdentity(
  reference: CanonicalGenerationRequest['references'][number],
): string {
  return reference.kind === 'asset'
    ? `asset\u0000${reference.assetId}`
    : `https\u0000${reference.url}`;
}

function validateReferenceBudget(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  selectedFields: readonly (readonly EngineInputField[])[],
): void {
  const budget = candidate.engine.inputSchema?.referenceBudget;
  const engineMode = toEngineGenerationMode(candidate.engine.id, request.mode);
  if (!budget || (budget.modes?.length && !budget.modes.includes(engineMode))) return;
  const budgetFieldIds = new Set(budget.fieldIds);
  const budgetReferences = request.references.filter((_, index) =>
    selectedFields[index]?.some((field) => budgetFieldIds.has(field.id)));
  const count = budget.countUniqueUrls
    ? new Set(budgetReferences.map(referenceSourceIdentity)).size
    : budgetReferences.length;
  if (count > budget.maxTotal) fail('references', 'reference_invalid');
}

function validateReferences(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (request.mode === 't2v') {
    if (request.references.length) fail('references', 'reference_invalid');
    return;
  }
  if (candidate.surface === 'image') {
    const constraints = getReferenceConstraints(candidate.engine, request.mode as ImageGenerationMode);
    const generationReferences = request.references.filter((reference) => reference.role !== 'mask');
    if (generationReferences.length < constraints.min || generationReferences.length > constraints.max) {
      fail('references', generationReferences.length < constraints.min ? 'reference_required' : 'reference_invalid');
    }
    if (
      (request.engineId === 'seedream' || request.engineId === 'seedream-5-0-pro')
      && generationReferences.length + request.outputCount > SEEDREAM_MAX_IMAGE_SET_IMAGES
    ) fail('references', 'reference_invalid');
  }
  if (options.resolvedReferences) {
    const resolvedKeys = new Set<string>();
    for (const resolved of options.resolvedReferences) {
      const key = `${resolved.assetId}\u0000${resolved.role}\u0000${resolved.slot ?? ''}`;
      if (resolvedKeys.has(key)) fail('references', 'reference_invalid');
      resolvedKeys.add(key);
      const matchingReferences = request.references.filter((reference) =>
        reference.kind === 'asset'
        && reference.assetId === resolved.assetId
        && reference.role === resolved.role
        && reference.slot === resolved.slot);
      if (matchingReferences.length !== 1) fail('references', 'reference_invalid');
    }
  }
  const selectedFields: EngineInputField[][] = [];
  const counts = new Map<EngineInputField, number>();
  for (const reference of request.references) {
    const fields = fieldsForReference(
      request,
      candidate,
      reference,
      resolvedMediaKind(reference, options),
    );
    if (!fields.length) fail('references', 'reference_invalid');
    validateTrustedReferenceDuration(reference, fields, candidate, options);
    selectedFields.push(fields);
    if (fields.length === 1) {
      const field = fields[0]!;
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }
  const possibleFields = new Set(
    request.references.flatMap((reference) =>
      fieldsForReference(request, candidate, reference, null)),
  );
  for (const role of ['source', 'reference', 'first_frame', 'last_frame', 'mask'] as const) {
    const placeholder: CanonicalGenerationReference = {
      kind: 'asset',
      assetId: 'capability-placeholder',
      role,
    };
    for (const field of fieldsForReference(request, candidate, placeholder, null)) {
      possibleFields.add(field);
    }
  }
  for (const field of possibleFields) {
    const count = counts.get(field) ?? 0;
    const required = Boolean(field.requiredInModes?.includes(
      toEngineGenerationMode(candidate.engine.id, request.mode),
    ));
    const minimum = required ? Math.max(1, field.minCount ?? 1) : 0;
    const maximum = field.maxCount ?? 1;
    const hasDeferredAsset = request.references.some((reference, index) =>
      reference.kind === 'asset'
      && !options.resolvedReferences
      && selectedFields[index]?.length !== 1
      && selectedFields[index]?.includes(field));
    if (count < minimum && !hasDeferredAsset) fail('references', 'reference_required');
    if (count > maximum) fail('references', 'reference_invalid');
  }
  const atLeastOneReferenceField = candidate.engine.inputSchema?.constraints?.atLeastOneReferenceField;
  if (Array.isArray(atLeastOneReferenceField) && atLeastOneReferenceField.length) {
    const accepted = new Set(atLeastOneReferenceField);
    const hasReference = selectedFields.some((fields) => fields.some((field) => accepted.has(field.id)));
    if (!hasReference) fail('references', 'reference_required');
  }
  if (
    request.mode === 'a2v'
    && candidate.engine.inputSchema?.constraints?.a2vPromptRequiredWithoutImage
    && !request.prompt.trim()
    && !request.references.some((reference, index) =>
      reference.role === 'first_frame'
      && selectedFields[index]?.some((field) => field.type === 'image'))
  ) fail('prompt');
  validateReferenceBudget(request, candidate, selectedFields);
  validateCombinedReferenceDurations(candidate, options);
}

export function validateCanonicalGenerationCapabilities(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions = {},
): void {
  if (
    candidate.engine.id !== request.engineId
    || candidate.surface !== request.surface
    || !candidate.publicModes.includes(request.mode)
  ) {
    fail('engineId');
  }
  if (
    typeof candidate.engine.inputLimits.promptMaxChars === 'number'
    && request.prompt.length > candidate.engine.inputLimits.promptMaxChars
  ) {
    fail('prompt');
  }
  const modeCaps = candidate.modeCaps[request.mode];
  if (!modeCaps) fail('mode');
  if (request.surface === 'video') validateVideoModeCaps(request, modeCaps, candidate);
  else validateImageSettings(request, candidate);
  validateReferences(request, candidate, options);
  validateDerivedSourceFacts(request, candidate, options);
  if (request.surface === 'video') validateVideoExecutionConstraints(request, candidate, options);
}
