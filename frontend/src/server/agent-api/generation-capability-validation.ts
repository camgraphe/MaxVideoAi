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

import type { CanonicalGenerationRequest } from './generation-types';
import type { AgentPublicGenerationEngine } from './model-catalog';

const VIDEO_FIELD_BY_SETTING: Record<string, string> = {
  cameraFixed: 'camera_fixed',
  cfgScale: 'cfg_scale',
  negativePrompt: 'negative_prompt',
  safetyChecker: 'enable_safety_checker',
  seed: 'seed',
  shotType: 'shot_type',
};
const IMAGE_FIELD_BY_SETTING: Record<string, string> = {
  enableWebSearch: 'enable_web_search',
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
  const fields = [
    ...(candidate.engine.inputSchema?.required ?? []),
    ...(candidate.engine.inputSchema?.optional ?? []),
  ];
  return fields.find((field) =>
    field.id === fieldId
    && (!field.modes?.length || field.modes.includes(mode))) ?? null;
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
      (typeof value !== 'string' && typeof value !== 'number')
      || (field.values?.length && !field.values.some((allowed) => String(allowed) === String(value)))
    ) {
      fail(field.id);
    }
    return;
  }
  fail(field.id);
}

function matchesDurationOption(duration: number, option: string | number): boolean {
  if (typeof option === 'number') return duration === option;
  const numeric = Number(option.replace(/[^\d.]/gu, ''));
  return Number.isFinite(numeric) && duration === numeric;
}

function validateVideoModeCaps(
  request: CanonicalGenerationRequest,
  caps: EngineModeUiCaps,
  candidate: AgentPublicGenerationEngine,
): void {
  const duration = request.settings.durationSec;
  if (!Number.isSafeInteger(duration) || (duration as number) < 1) fail('durationSec');
  if (!caps.duration || caps.frames) fail('durationSec');
  if (
    'options' in caps.duration
      ? !caps.duration.options.some((option) => matchesDurationOption(duration as number, option))
      : (duration as number) < caps.duration.min
  ) {
    fail('durationSec');
  }
  if ((duration as number) > candidate.engine.maxDurationSec) fail('durationSec');

  const resolution = request.settings.resolution;
  if (
    typeof resolution !== 'string'
    || !caps.resolution?.includes(resolution)
    || !candidate.engine.resolutions.includes(resolution as never)
  ) {
    fail('resolution');
  }
  const aspectRatio = request.settings.aspectRatio;
  if (
    typeof aspectRatio !== 'string'
    || !caps.aspectRatio?.includes(aspectRatio)
    || !candidate.engine.aspectRatios.includes(aspectRatio as never)
  ) {
    fail('aspectRatio');
  }
  const fps = request.settings.fps;
  if (fps !== undefined) {
    const allowed = Array.isArray(caps.fps) ? caps.fps : typeof caps.fps === 'number' ? [caps.fps] : [];
    if (!Number.isSafeInteger(fps) || !allowed.includes(fps as number)) fail('fps');
  }
  const audio = request.settings.audio;
  if (audio !== undefined && (typeof audio !== 'boolean' || !caps.audioToggle)) fail('audio');

  for (const [setting, fieldId] of [
    ['durationSec', 'duration'],
    ['resolution', 'resolution'],
    ['aspectRatio', 'aspect_ratio'],
    ['fps', 'fps'],
    ['audio', 'generate_audio'],
  ] as const) {
    const value = request.settings[setting];
    const field = applicableField(candidate, fieldId, request.mode);
    if (value !== undefined && field) validateFieldValue(field, value);
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
}

function fieldsForRole(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
): Map<CanonicalGenerationRequest['references'][number]['role'], EngineInputField | null> {
  if (request.mode === 'i2v') {
    return new Map([
      ['source', applicableField(candidate, 'image_url', request.mode)],
      ['first_frame', applicableField(candidate, 'first_frame_url', request.mode)
        ?? applicableField(candidate, 'start_image_url', request.mode)
        ?? applicableField(candidate, 'image_url', request.mode)],
      ['last_frame', applicableField(candidate, 'end_image_url', request.mode)
        ?? applicableField(candidate, 'last_frame_url', request.mode)],
      ['reference', applicableField(candidate, 'image_urls', request.mode)
        ?? applicableField(candidate, 'reference_image_urls', request.mode)],
    ]);
  }
  const plural = applicableField(candidate, 'image_urls', request.mode)
    ?? applicableField(candidate, 'reference_image_urls', request.mode);
  return new Map([
    ['source', request.mode === 'i2i' ? plural : applicableField(candidate, 'start_image_url', request.mode)],
    ['first_frame', applicableField(candidate, 'start_image_url', request.mode)],
    ['last_frame', applicableField(candidate, 'end_image_url', request.mode)],
    ['reference', plural],
  ]);
}

function validateReferences(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
): void {
  if (request.mode === 't2v' || request.mode === 't2i') {
    if (request.references.length) fail('references', 'reference_invalid');
    return;
  }
  if (candidate.surface === 'image') {
    const constraints = getReferenceConstraints(candidate.engine, request.mode as ImageGenerationMode);
    if (request.references.length < constraints.min || request.references.length > constraints.max) {
      fail('references', request.references.length < constraints.min ? 'reference_required' : 'reference_invalid');
    }
  }
  const roleFields = fieldsForRole(request, candidate);
  const counts = new Map<EngineInputField, number>();
  for (const reference of request.references) {
    const field = roleFields.get(reference.role);
    if (!field) fail('references', 'reference_invalid');
    counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  for (const field of new Set([...roleFields.values()].filter((value): value is EngineInputField => Boolean(value)))) {
    const count = counts.get(field) ?? 0;
    const required = Boolean(field.requiredInModes?.includes(request.mode));
    const minimum = required ? Math.max(1, field.minCount ?? 1) : 0;
    const maximum = field.maxCount ?? 1;
    if (count < minimum) fail('references', 'reference_required');
    if (count > maximum) fail('references', 'reference_invalid');
  }
}

export function validateCanonicalGenerationCapabilities(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
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
  validateReferences(request, candidate);
}
