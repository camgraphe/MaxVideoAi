import { isFluxLtxSourceOperation } from '@/lib/flux-ltx-operations';
import { isH3SourceOperation } from '@/lib/h3-source-operations';
import { validateLumaCanonicalShape } from './generation-luma-shape';
import { validateOwnedKlingElements, isElementReference } from '@/lib/kling-owned-elements';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { videoDurationPolicy, videoInheritsSourceFraming } from '@/lib/video-workflow-capabilities';
import { isLumaSourceVideoMode, validateLumaSourceVideoTiming, LUMA_MODIFY_SOURCE_MAX_SEC } from '@/lib/luma-source-video';
import {
  canonicalizeImageFieldValue,
  getImageCountConstraints,
  getImageFieldValues,
  getImageInputField,
  getReferenceConstraints,
  resolveRequestedAspectRatio,
  resolveRequestedResolution,
} from '@/lib/image/inputSchema';
import type { EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { isLumaRay2EngineId } from '@/lib/luma-ray2';
import { isGptImageFamilyEngineId, validateGptImage2CustomImageSize } from '@/lib/image/gptImage2';
import { SEEDREAM_MAX_IMAGE_SET_IMAGES } from '@/lib/image/seedream';
import { seedanceAutomaticDurationBounds } from '@/lib/seedance-option-pricing';
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
import {
  resolveEngineMediaFieldConstraint,
  validateMediaFileAgainstConstraint,
  validateImageAspectRatio,
} from '@/lib/media-field-constraints';

const VIDEO_FIELD_BY_SETTING: Record<string, string> = {
  keepAudio: 'keep_audio',
  safetyTolerance: 'safety_tolerance',
  audioSetting: 'audio_setting',
  personGeneration: 'person_generation',
  compressionQuality: 'compression_quality',
  promptAudioDirection: 'prompt_audio_direction',
  promptCameraDirection: 'prompt_camera_direction',
  promptEditInstruction: 'prompt_edit_instruction',
  outputFormat: 'output_format',
  returnLastFrame: 'return_last_frame',
  watermark: 'watermark',
  cameraFixed: 'camera_fixed',
  cfgScale: 'cfg_scale',
  contextSec: 'context',
  cropEndX: 'x_end',
  cropEndY: 'y_end',
  cropStartX: 'x_start',
  cropStartY: 'y_start',
  documentUrl: 'file_url',
  editDepthBlur: 'edit_depth_blur',
  extendDirection: 'extend_direction',
  editFace: 'edit_face',
  editControlMode: 'edit_control_mode',
  editPoseMode: 'edit_pose_mode',
  editDepthMode: 'edit_depth_mode',
  editNormalsMode: 'edit_normals_mode',
  editTrajectoryMode: 'edit_trajectory_mode',
  editFaceMode: 'edit_face_mode',
  editKeyframeIndexes: 'edit_keyframe_indexes',
  reasoningLevel: 'reasoning_level',
  keyframeIndexes: 'keyframe_indexes',
  editNormalsAugmentation: 'edit_normals_augmentation',
  editPoseStrength: 'edit_pose_strength',
  editStrength: 'edit_strength',
  editTrajectorySparsity: 'edit_trajectory_sparsity',
  exrExport: 'exr_export',
  enablePromptExpansion: 'enable_prompt_expansion',
  extendPosition: 'mode',
  guidanceScale: 'guidance_scale',
  hdr: 'hdr',
  modifyStrength: 'mode',
  multiPrompt: 'multi_prompt',
  negativePrompt: 'negative_prompt',
  promptExpansionMode: 'prompt_expansion_mode',
  enhanceRealism: 'enhance_realism',
  middleFrameTime: 'middle_frame_time',
  referenceOrder: 'reference_order',
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
  webpageUrl: 'web_url',
};
const IMAGE_FIELD_BY_SETTING: Record<string, string> = {
  background: 'background',
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

export type ReferenceConstraintFailure =
  | 'metadata_unverified'
  | 'dimensions_unverified'
  | 'duration_unverified'
  | 'duration_unsupported'
  | 'combined_duration_exceeded'
  | 'size_exceeded'
  | 'format_unsupported'
  | 'image_aspect_ratio_unsupported'
  | 'image_dimensions_too_small';

export class GenerationCapabilityError extends Error {
  constructor(
    readonly field: string,
    readonly kind: 'parameter_invalid' | 'reference_required' | 'reference_invalid' = 'parameter_invalid',
    readonly referenceFailure?: ReferenceConstraintFailure,
  ) {
    super('The canonical generation request is not executable by this public model mode.');
    this.name = 'GenerationCapabilityError';
  }
}

function fail(
  field: string,
  kind: GenerationCapabilityError['kind'] = 'parameter_invalid',
  referenceFailure?: ReferenceConstraintFailure,
): never {
  throw new GenerationCapabilityError(field, kind, referenceFailure);
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
  if ((request.operation === 'kling-edit' || isH3SourceOperation(request.operation) || isFluxLtxSourceOperation(request.operation)) && (request.settings.durationSec !== undefined || request.settings.durationOption !== undefined)) fail('durationSec');
  const duration = request.settings.durationSec;
  if (request.settings.durationOption !== undefined && (request.settings.durationOption !== 'auto'
    || !seedanceAutomaticDurationBounds(candidate.engine.id) || !caps.duration || !('options' in caps.duration)
    || !caps.duration.options.includes('auto'))) fail('durationOption');
  const sourceDurationPending = duration === undefined
    && videoDurationPolicy(candidate.engine, request.mode as Mode, caps) === 'source_video';
  if (!sourceDurationPending) {
    if (!Number.isSafeInteger(duration) || (duration as number) < 1) fail('durationSec');
    if (caps.frames) fail('durationSec');
    if (caps.duration && !isVideoDurationSupported(duration, caps.duration, candidate.engine.maxDurationSec)) {
      fail('durationSec');
    }
    const maximum = request.engineId === 'luma-ray-3-2' && request.mode === 'v2v'
      ? LUMA_MODIFY_SOURCE_MAX_SEC : candidate.engine.maxDurationSec;
    if (!caps.duration && (duration as number) > maximum) fail('durationSec');
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
  const sourceFraming = aspectRatio === undefined && videoInheritsSourceFraming(candidate.engine, request.mode as Mode);
  if (!sourceFraming && supportedAspectRatios.length > 0 && (
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
    if (setting === 'multiPrompt') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 6) fail(setting);
      const total = value.reduce((sum, scene) => sum + scene.durationSec, 0);
      if (
        request.prompt.length > 0
        || total !== request.settings.durationSec
        || value.some((scene) => !scene.prompt || scene.prompt.length > 512)
      ) fail(setting);
      continue;
    }
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
  const ownedAssetModes = candidate.engine.inputSchema?.constraints?.ownedAssetModes;
  if (
    Array.isArray(ownedAssetModes)
    && ownedAssetModes.includes(toEngineGenerationMode(candidate.engine.id, request.mode))
  ) {
    for (const reference of request.references) {
      if (reference.kind !== 'asset') fail('references', 'reference_invalid');
      if (!options.resolvedReferences) continue;
      const resolved = resolvedReference(reference, options);
      const fields = fieldsForReference(
        request,
        candidate,
        reference,
        resolved?.mediaKind ?? null,
      );
      if (!resolved || fields.length !== 1) fail('references', 'reference_invalid');
      const sizeBytes = resolved.sizeBytes;
      const originalName = resolved.originalName ?? resolved.storageUrl;
      if (
        typeof sizeBytes !== 'number'
        || !Number.isSafeInteger(sizeBytes)
        || sizeBytes <= 0
        || !resolved.mimeType
        || !originalName
      ) fail('references', 'reference_invalid', 'metadata_unverified');
      if (
        (resolved.mediaKind === 'image' || resolved.mediaKind === 'video')
        && (
          !Number.isSafeInteger(resolved.width)
          || !Number.isSafeInteger(resolved.height)
          || Number(resolved.width) <= 0
          || Number(resolved.height) <= 0
        )
      ) fail('references', 'reference_invalid', 'dimensions_unverified');
      const mediaValidation = validateMediaFileAgainstConstraint({
        name: originalName,
        mimeType: resolved.mimeType,
        sizeBytes,
        constraint: resolveEngineMediaFieldConstraint({
          engine: candidate.engine,
          field: fields[0]!,
        }),
      });
      if (!mediaValidation.ok) fail('references', 'reference_invalid',
        mediaValidation.reason === 'size' ? 'size_exceeded' : 'format_unsupported');
    }
  }
  if (
    isGptImageFamilyEngineId(request.engineId)
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
        (request.mode === 'a2v' || (request.mode === 'reframe' && request.engineId !== 'luma-ray-3-2' && request.operation!=='ltx23-reframe'))
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
    if (value === undefined) continue;
    payload[fieldId] = setting === 'multiPrompt' && Array.isArray(value)
      ? value.map((scene) => ({ prompt: scene.prompt, duration: scene.durationSec }))
      : value;
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
  // Asset modality is unavailable during initial canonical ingress. Keep all other
  // validation active; check the complete permutation after owned facts resolve.
  if (request.engineId === 'minimax-h3-max' && request.references.some(reference => !resolvedMediaKind(reference, options))) delete payload.reference_order;
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
  allowUnverifiedReferenceDuration?: boolean;
};

const REFERENCE_FIELD_TYPES = new Set<EngineInputField['type']>(['image', 'video', 'audio']);

function fieldIdsForRole(
  request: CanonicalGenerationRequest,
  role: CanonicalGenerationReference['role'],
): readonly string[] {
  if (request.mode === 't2v') {
    return role === 'reference' ? ['target_audio_url', 'keyframe_urls'] : [];
  }
  if (request.mode === 'i2v' || request.mode === 'i2v_standard') {
    if (role === 'source') return ['image_url', 'start_image_url', 'first_frame_url'];
    if (role === 'first_frame') return ['first_frame_url', 'start_image_url', 'image_url'];
    if (role === 'last_frame') return ['end_image_url', 'last_frame_url'];
    return role === 'reference' ? ['image_urls', 'reference_image_urls', 'target_audio_url'] : [];
  }
  if (request.mode === 'ref2v') {
    if (role === 'middle_frame') return ['middle_image_url'];
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
    if (role === 'first_frame') return ['first_frame_url', 'start_image_url', 'image_url'];
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
        'reference_image_url',
        'audio_urls',
        'reference_audio_urls',
      ]
      : [];
  }
  if (request.mode === 'r2v') {
    return role === 'reference' ? ['video_urls'] : [];
  }
  if (request.mode === 'extend') {
    if (role === 'source') return ['extension_source_videos', 'video_urls', 'video_url'];
    return role === 'reference' ? ['reference_image_urls', 'image_urls', 'reference_audio_urls', 'audio_urls'] : [];
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

/** Quote the same owned audio file that the paid submission will validate. */
function validateTrustedAudioFormat(
  reference: CanonicalGenerationReference,
  fields: readonly EngineInputField[],
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (fields.length !== 1 || fields[0]!.type !== 'audio'
    || reference.kind !== 'asset' || !options.resolvedReferences) return;
  const field = fields[0]!;
  // These field-level audio formats also run at the paid attachment boundary.
  if (!field.acceptedMimeTypes?.length && !field.acceptedFileExtensions?.length) return;
  const resolved = resolvedReference(reference, options);
  if (!resolved) fail('references', 'reference_invalid');
  const sizeBytes = resolved.sizeBytes;
  if (typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes)
    || sizeBytes <= 0 || !resolved.mimeType) {
    fail('references', 'reference_invalid', 'metadata_unverified');
  }
  const validation = validateMediaFileAgainstConstraint({
    name: resolved.originalName ?? resolved.storageUrl,
    mimeType: resolved.mimeType,
    sizeBytes,
    constraint: resolveEngineMediaFieldConstraint({ engine: candidate.engine, field }),
  });
  if (!validation.ok) fail('references', 'reference_invalid',
    validation.reason === 'size' ? 'size_exceeded' : 'format_unsupported');
}

function validateTrustedReferenceDuration(
  request: CanonicalGenerationRequest,
  reference: CanonicalGenerationReference,
  fields: readonly EngineInputField[],
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (fields.length !== 1) return;
  const field = fields[0]!;
  const constraints = candidate.engine.inputSchema?.constraints;
  const combinedModes = constraints?.combinedDurationModes;
  const combinedLimitsApply = !Array.isArray(combinedModes)
    || combinedModes.includes(toEngineGenerationMode(candidate.engine.id, request.mode));
  const combinedLimit = !combinedLimitsApply ? undefined : field.type === 'video'
    ? constraints?.maxCombinedVideoDurationSec
    : field.type === 'audio'
      ? constraints?.maxCombinedAudioDurationSec
      : undefined;
  if ((request.operation === 'kling-edit' || isH3SourceOperation(request.operation) || isFluxLtxSourceOperation(request.operation)) && reference.role === 'source' && reference.kind !== 'asset') fail('references', 'reference_invalid', 'duration_unverified');
  const exclusiveMaximum =
    requestModeForExclusiveDuration(candidate, field);
  const sourcePlusOutputMaximum = field.id === 'video_url'
    ? constraints?.maxSourcePlusOutputDurationSec
    : undefined;
  if (
    field.minDurationSec === undefined
    && field.maxDurationSec === undefined
    && combinedLimit === undefined
    && exclusiveMaximum === undefined
    && sourcePlusOutputMaximum === undefined
  ) return;
  // Preparation validates role/schema shape before looking up owned media.
  // An asset reference is revalidated with persisted metadata immediately after resolution.
  if (isLumaSourceVideoMode(candidate.engine.id, request.mode) && field.id === 'video_url' && reference.kind !== 'asset') {
    fail('references', 'reference_invalid', 'duration_unverified');
  }
  if (reference.kind === 'asset' && !options.resolvedReferences) return;
  if (reference.kind !== 'asset' || !options.resolvedReferences) {
    if (options.allowUnverifiedReferenceDuration) return;
    if (candidate.engine.id === 'minimax-h3'
      || ((candidate.engine.id === 'wan-3' || candidate.engine.id === 'wan-3-prime') && field.type === 'video')) {
      fail('references', 'reference_invalid');
    }
    return;
  }
  const resolved = resolvedReference(reference, options);
  if (!resolved) fail('references', 'reference_invalid');
  const durationSec = resolved.durationSec;
  const requestedOutputDurationSec = request.settings.durationSec;
  if (field.id === 'video_url' && validateLumaSourceVideoTiming({ engineId: candidate.engine.id, mode: request.mode,
    sourceDurationSec: durationSec, durationSec: Number(requestedOutputDurationSec) })) {
    fail('references', 'reference_invalid', 'duration_unsupported');
  }
  if (
    typeof durationSec !== 'number'
    || !Number.isFinite(durationSec)
    || durationSec <= 0
  ) fail('references', 'reference_invalid', 'duration_unverified');
  if (
    (typeof field.minDurationSec === 'number' && durationSec < field.minDurationSec)
    || (typeof field.maxDurationSec === 'number' && durationSec > field.maxDurationSec)
    || (typeof exclusiveMaximum === 'number' && durationSec >= exclusiveMaximum)
    || (
      typeof sourcePlusOutputMaximum === 'number'
      && typeof requestedOutputDurationSec === 'number'
      && durationSec + requestedOutputDurationSec > sourcePlusOutputMaximum
    )
  ) fail('references', 'reference_invalid', 'duration_unsupported');
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
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions,
): void {
  if (!options.resolvedReferences) return;
  const constraints = candidate.engine.inputSchema?.constraints;
  const combinedModes = constraints?.combinedDurationModes;
  if (Array.isArray(combinedModes)
    && !combinedModes.includes(toEngineGenerationMode(candidate.engine.id, request.mode))) return;
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
      ) fail('references', 'reference_invalid', 'duration_unverified');
      durations.set(resolved.storageUrl, resolved.durationSec);
    }
    const total = [...durations.values()].reduce((sum, durationSec) => sum + durationSec, 0);
    if (total > limit) fail('references', 'reference_invalid', 'combined_duration_exceeded');
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
    validateTrustedReferenceDuration(request, reference, fields, candidate, options);
    validateTrustedAudioFormat(reference, fields, candidate, options);
    // H3's executable references already require owned, measured originals.
    const minimumImageSide = candidate.engine.id === 'minimax-h3'
      ? candidate.engine.inputSchema?.constraints?.minImageSidePx : undefined;
    if (fields.length === 1 && fields[0]!.type === 'image'
      && typeof minimumImageSide === 'number' && minimumImageSide > 0 && options.resolvedReferences) {
      const resolved = resolvedReference(reference, options);
      if (typeof resolved?.width !== 'number' || typeof resolved.height !== 'number'
        || !Number.isFinite(resolved.width) || !Number.isFinite(resolved.height)
        || resolved.width <= 0 || resolved.height <= 0) {
        fail('references', 'reference_invalid', 'dimensions_unverified');
      }
      if (resolved.width < minimumImageSide || resolved.height < minimumImageSide) {
        fail('references', 'reference_invalid', 'image_dimensions_too_small');
      }
    }
    if (fields.length === 1 && fields[0]!.imageAspectRatio) {
      if (reference.kind !== 'asset') {
        // Budget estimates may describe unverified media; executable quotes may not.
        if (!options.allowUnverifiedReferenceDuration) fail('references', 'reference_invalid');
      } else if (options.resolvedReferences) {
        const resolved = resolvedReference(reference, options);
        const geometry = validateImageAspectRatio(fields[0]!, resolved?.width, resolved?.height);
        if (geometry !== 'valid') {
          fail('references', 'reference_invalid',
            geometry === 'unverified' ? 'dimensions_unverified' : 'image_aspect_ratio_unsupported');
        }
      }
    }
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
  for (const role of ['source', 'reference', 'first_frame', 'middle_frame', 'last_frame', 'mask'] as const) {
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
  if (
    (request.mode === 'ref2v' || request.mode === 'i2v')
    && Array.isArray(atLeastOneReferenceField)
    && atLeastOneReferenceField.length
  ) {
    const accepted = new Set(atLeastOneReferenceField.filter((fieldId) =>
      typeof fieldId === 'string' && applicableField(candidate, fieldId, request.mode)));
    const hasReference = selectedFields.some((fields) => fields.some((field) => accepted.has(field.id)))
      || Object.entries(VIDEO_FIELD_BY_SETTING).some(([setting, fieldId]) =>
        accepted.has(fieldId)
        && applicableField(candidate, fieldId, request.mode)
        && typeof request.settings[setting] === 'string'
        && String(request.settings[setting]).trim().length > 0);
    if (accepted.size && !hasReference) fail('references', 'reference_required');
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
  validateCombinedReferenceDurations(request, candidate, options);
}

export function validateCanonicalGenerationCapabilities(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  options: GenerationCapabilityValidationOptions = {},
): void {
  try {
    const engine = resolveVideoOperationEngine(candidate.engine, request.mode as Mode, request.operation);
    if (engine !== candidate.engine) {
      const mode = request.mode as Mode;
      candidate = { ...candidate, engine, modeCaps: { ...candidate.modeCaps, [request.mode]: engine.modeCaps?.[mode] } };
    }
  } catch { fail('operation'); }
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
  if (['h3-relight','ltx23-reframe','flux-draft-enhance'].includes(request.operation??'') && request.prompt.trim()) fail('prompt');
  if (request.operation === 'h3-recast' && request.prompt.length>2000) fail('prompt');
  if (request.surface === 'video') validateVideoModeCaps(request, modeCaps, candidate);
  else validateImageSettings(request, candidate);
  try { validateOwnedKlingElements(request, options.resolvedReferences); } catch { fail('elements', 'reference_invalid'); }
  const ordinaryRequest = request.engineId === 'luma-ray-3-2' && request.mode === 'extend' ? { ...request, references: [] } : request.elements ? { ...request, references: request.references.filter(ref => !isElementReference(ref, request.elements)) } : request;
  const ordinaryOptions = request.elements && options.resolvedReferences ? { ...options, resolvedReferences: options.resolvedReferences.filter(ref => !isElementReference(ref, request.elements)) } : options;
  validateReferences(ordinaryRequest, candidate, ordinaryOptions);
  validateDerivedSourceFacts(ordinaryRequest, candidate, ordinaryOptions);
  if (request.surface === 'video') validateVideoExecutionConstraints(ordinaryRequest, candidate, ordinaryOptions);
  if (request.engineId === 'luma-ray-3-2') {
    try { validateLumaCanonicalShape(request, Object.fromEntries(Object.entries(request.settings)
      .map(([key, value]) => [VIDEO_FIELD_BY_SETTING[key] ?? key, value]))); }
    catch { fail('settings'); }
  }
}
