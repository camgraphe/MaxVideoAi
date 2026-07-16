import { computePricingDefinitionFacts } from '@maxvideoai/pricing';

import { buildPricingDefinition } from '@/lib/pricing-definition';
import type { EngineInputField, EngineModeUiCaps } from '@/types/engines';

import type { CanonicalGenerationRequest } from './generation-types';
import { normalizeGenerationRequest } from './generation-normalization';
import { isPublicAgentEngine, type AgentPublicGenerationEngine } from './public-engine-policy';

const MCP_TRIAL_ASPECT_RATIOS = Object.freeze(['16:9', '9:16', '1:1'] as const);

export const MCP_TRIAL_PRESET = Object.freeze({
  engineId: 'seedance-2-0-mini',
  surface: 'video',
  mode: 't2v',
  durationSec: 5,
  resolution: '480p',
  aspectRatios: MCP_TRIAL_ASPECT_RATIOS,
  outputCount: 1,
} as const);

const RAW_CANDIDATE_FIELDS = new Set([
  'schemaVersion',
  'surface',
  'engineId',
  'mode',
  'prompt',
  'settings',
  'references',
  'outputCount',
]);
const RAW_SETTING_FIELDS = new Set(['aspectRatio', 'audio']);
const MEDIA_FIELD_TYPES = new Set(['image', 'video', 'audio']);
const MODERN_ADDON_PRICING_FIELDS = new Set([
  'perSecondCents',
  'perSecondCentsByResolution',
  'flatCents',
]);
const LEGACY_ADDON_PRICING_FIELDS = new Set(['perSecond', 'flat']);

export class TrialCandidateError extends Error {
  constructor() {
    super('The trial candidate is invalid.');
    this.name = 'TrialCandidateError';
  }
}

export class TrialPresetUnsupportedError extends Error {
  constructor(readonly reason: string) {
    super('The trial preset is not supported by the current public catalog.');
    this.name = 'TrialPresetUnsupportedError';
  }
}

function invalidCandidate(): never {
  throw new TrialCandidateError();
}

function unsupported(reason: string): never {
  throw new TrialPresetUnsupportedError(reason);
}

function assertPlainDataObject(
  value: unknown,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalidCandidate();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalidCandidate();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') invalidCandidate();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) invalidCandidate();
  }
}

function assertExactRawFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) invalidCandidate();
  }
}

function assertEmptyDataArray(value: unknown): void {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== 0) {
    invalidCandidate();
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key !== 'length') invalidCandidate();
  }
}

function validateRawTrialCandidate(input: unknown): asserts input is Record<string, unknown> {
  assertPlainDataObject(input);
  assertExactRawFields(input, RAW_CANDIDATE_FIELDS);

  if (Object.hasOwn(input, 'schemaVersion') && input.schemaVersion !== 1) invalidCandidate();
  if (input.engineId !== MCP_TRIAL_PRESET.engineId) invalidCandidate();
  if (input.surface !== MCP_TRIAL_PRESET.surface) invalidCandidate();
  if (input.mode !== MCP_TRIAL_PRESET.mode) invalidCandidate();
  if (Object.hasOwn(input, 'outputCount') && input.outputCount !== MCP_TRIAL_PRESET.outputCount) {
    invalidCandidate();
  }

  if (Object.hasOwn(input, 'references')) assertEmptyDataArray(input.references);

  if (Object.hasOwn(input, 'settings')) {
    assertPlainDataObject(input.settings);
    assertExactRawFields(input.settings, RAW_SETTING_FIELDS);
    const aspectRatio = input.settings.aspectRatio;
    if (
      Object.hasOwn(input.settings, 'aspectRatio')
      && (
        typeof aspectRatio !== 'string'
        || !MCP_TRIAL_PRESET.aspectRatios.includes(
          aspectRatio as (typeof MCP_TRIAL_PRESET.aspectRatios)[number],
        )
      )
    ) {
      invalidCandidate();
    }
    if (Object.hasOwn(input.settings, 'audio') && typeof input.settings.audio !== 'boolean') {
      invalidCandidate();
    }
  }
}

export function normalizeTrialCandidate(input: unknown): CanonicalGenerationRequest {
  try {
    validateRawTrialCandidate(input);
    const normalized = normalizeGenerationRequest(input);
    const aspectRatio = normalized.settings.aspectRatio ?? MCP_TRIAL_PRESET.aspectRatios[0];
    const audio = normalized.settings.audio ?? true;
    return {
      schemaVersion: 1,
      surface: MCP_TRIAL_PRESET.surface,
      engineId: MCP_TRIAL_PRESET.engineId,
      mode: MCP_TRIAL_PRESET.mode,
      prompt: normalized.prompt,
      settings: {
        aspectRatio,
        audio,
        durationSec: MCP_TRIAL_PRESET.durationSec,
        resolution: MCP_TRIAL_PRESET.resolution,
      },
      references: [],
      outputCount: MCP_TRIAL_PRESET.outputCount,
    };
  } catch (error) {
    if (error instanceof TrialCandidateError) throw error;
    throw new TrialCandidateError();
  }
}

function fieldAppliesToTrial(field: EngineInputField): boolean {
  return !field.modes?.length || field.modes.includes(MCP_TRIAL_PRESET.mode);
}

function findTrialField(
  engine: AgentPublicGenerationEngine['engine'],
  id: string,
): EngineInputField | undefined {
  return [
    ...(engine.inputSchema?.required ?? []),
    ...(engine.inputSchema?.optional ?? []),
  ].find((field) => field.id === id && fieldAppliesToTrial(field));
}

function durationCapsSupportPreset(caps: EngineModeUiCaps): boolean {
  const duration = caps.duration;
  if (!duration || typeof duration !== 'object') return false;
  if ('options' in duration) {
    return Array.isArray(duration.options)
      && duration.options.some((value) =>
        value === MCP_TRIAL_PRESET.durationSec || value === String(MCP_TRIAL_PRESET.durationSec),
      );
  }
  return Number.isFinite(duration.min) && duration.min <= MCP_TRIAL_PRESET.durationSec;
}

function assertFiniteNonNegative(value: unknown, reason: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) unsupported(reason);
}

function assertPlainPricingObject(
  value: unknown,
  reason: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) unsupported(reason);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) unsupported(reason);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') unsupported(reason);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) unsupported(reason);
  }
}

function pricingDataEntries(value: Record<string, unknown>): Array<[string, unknown]> {
  return Object.keys(value).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) unsupported('pricing_malformed');
    return [key, descriptor.value];
  });
}

function validateModernAddonRule(
  engine: AgentPublicGenerationEngine['engine'],
  value: unknown,
): void {
  assertPlainPricingObject(value, 'pricing_addons_malformed');
  for (const [field, fieldValue] of pricingDataEntries(value)) {
    if (!MODERN_ADDON_PRICING_FIELDS.has(field)) unsupported('pricing_addons_malformed');
    if (field === 'perSecondCentsByResolution') {
      assertPlainPricingObject(fieldValue, 'pricing_addons_malformed');
      for (const [resolution, amount] of pricingDataEntries(fieldValue)) {
        if (!engine.resolutions.includes(resolution as never)) unsupported('pricing_addons_malformed');
        assertFiniteNonNegative(amount, 'pricing_addons_malformed');
      }
    } else {
      assertFiniteNonNegative(fieldValue, 'pricing_addons_malformed');
    }
  }
}

function validateLegacyAddonRule(value: unknown): void {
  assertPlainPricingObject(value, 'pricing_addons_malformed');
  for (const [field, fieldValue] of pricingDataEntries(value)) {
    if (!LEGACY_ADDON_PRICING_FIELDS.has(field)) unsupported('pricing_addons_malformed');
    assertFiniteNonNegative(fieldValue, 'pricing_addons_malformed');
  }
}

function validateAddonSource(
  engine: AgentPublicGenerationEngine['engine'],
  value: unknown,
  source: 'modern' | 'legacy',
): void {
  assertPlainPricingObject(value, 'pricing_addons_malformed');
  for (const [, rule] of pricingDataEntries(value)) {
    if (source === 'modern') validateModernAddonRule(engine, rule);
    else validateLegacyAddonRule(rule);
  }
}

function assertPricingInputShapes(engine: AgentPublicGenerationEngine['engine']): void {
  const pricingDetails = engine.pricingDetails;
  const legacyPricing = engine.pricing;
  if (pricingDetails !== undefined) {
    assertPlainPricingObject(pricingDetails, 'pricing_details_malformed');
  }
  if (legacyPricing !== undefined) {
    assertPlainPricingObject(legacyPricing, 'legacy_pricing_malformed');
  }

  const modernAddons = pricingDetails
    ? Object.getOwnPropertyDescriptor(pricingDetails, 'addons')
    : undefined;
  if (modernAddons) {
    if (!('value' in modernAddons)) unsupported('pricing_addons_malformed');
    validateAddonSource(engine, modernAddons.value, 'modern');
    return;
  }

  const legacyAddons = legacyPricing
    ? Object.getOwnPropertyDescriptor(legacyPricing, 'addons')
    : undefined;
  if (legacyAddons) {
    if (!('value' in legacyAddons)) unsupported('pricing_addons_malformed');
    validateAddonSource(engine, legacyAddons.value, 'legacy');
  }
}

function assertAudioPricingStable(engine: AgentPublicGenerationEngine['engine']): void {
  assertPricingInputShapes(engine);
  const definition = buildPricingDefinition(engine);
  if (!definition || definition.engineId !== MCP_TRIAL_PRESET.engineId) unsupported('pricing_missing');
  assertFiniteNonNegative(definition.baseUnitPriceCents, 'pricing_malformed');
  if (definition.baseUnitPriceCents === 0) unsupported('pricing_malformed');
  const resolutionMultiplier = definition.resolutionMultipliers[MCP_TRIAL_PRESET.resolution];
  assertFiniteNonNegative(resolutionMultiplier, 'pricing_resolution_missing');
  if (resolutionMultiplier === 0) unsupported('pricing_resolution_missing');

  const audioRule = definition.addons?.audio;
  if (audioRule !== undefined) {
    if (!audioRule || typeof audioRule !== 'object') unsupported('audio_pricing_malformed');
    for (const value of [audioRule.perSecondCents, audioRule.flatCents]) {
      if (value !== undefined) assertFiniteNonNegative(value, 'audio_pricing_malformed');
    }
    if (audioRule.perSecondCentsByResolution !== undefined) {
      if (
        audioRule.perSecondCentsByResolution === null
        || typeof audioRule.perSecondCentsByResolution !== 'object'
        || Array.isArray(audioRule.perSecondCentsByResolution)
      ) {
        unsupported('audio_pricing_malformed');
      }
      for (const value of Object.values(audioRule.perSecondCentsByResolution)) {
        assertFiniteNonNegative(value, 'audio_pricing_malformed');
      }
    }
  }

  const common = {
    durationSec: MCP_TRIAL_PRESET.durationSec,
    resolution: MCP_TRIAL_PRESET.resolution,
  };
  const audioOff = computePricingDefinitionFacts(definition, {
    ...common,
    addons: { audio: false },
  });
  const audioOn = computePricingDefinitionFacts(definition, {
    ...common,
    addons: { audio: true },
  });
  if (
    !Number.isFinite(audioOff.vendorSubtotalExactCents)
    || !Number.isFinite(audioOn.vendorSubtotalExactCents)
    || audioOff.vendorSubtotalExactCents !== audioOn.vendorSubtotalExactCents
  ) {
    unsupported('audio_price_changed');
  }
}

/**
 * Checks the local public catalog and versioned pricing-add-on facts only.
 * Trial quote preparation must re-check transactional pricing before eligibility.
 */
export function assertTrialPresetSupported(candidate: AgentPublicGenerationEngine): void {
  try {
    const engine = candidate.engine;
    if (
      candidate.surface !== MCP_TRIAL_PRESET.surface
      || !isPublicAgentEngine(engine, candidate.surface)
      || engine.id !== MCP_TRIAL_PRESET.engineId
      || engine.status !== 'live'
      || engine.availability !== 'available'
      || !engine.modes.includes(MCP_TRIAL_PRESET.mode)
      || !candidate.publicModes.includes(MCP_TRIAL_PRESET.mode)
      || engine.maxDurationSec < MCP_TRIAL_PRESET.durationSec
    ) {
      unsupported('identity_or_publication');
    }

    const modeCaps = candidate.modeCaps[MCP_TRIAL_PRESET.mode];
    if (
      !modeCaps
      || !modeCaps.modes.includes(MCP_TRIAL_PRESET.mode)
      || !durationCapsSupportPreset(modeCaps)
      || !modeCaps.resolution?.includes(MCP_TRIAL_PRESET.resolution)
      || !MCP_TRIAL_PRESET.aspectRatios.every((ratio) => modeCaps.aspectRatio?.includes(ratio))
      || modeCaps.audioToggle !== true
    ) {
      unsupported('mode_caps');
    }

    if (
      !engine.resolutions.includes(MCP_TRIAL_PRESET.resolution)
      || !MCP_TRIAL_PRESET.aspectRatios.every((ratio) => engine.aspectRatios.includes(ratio))
      || engine.audio !== true
    ) {
      unsupported('engine_caps');
    }

    if (!Array.isArray(engine.inputSchema?.required) || !Array.isArray(engine.inputSchema.optional)) {
      unsupported('input_schema_missing');
    }
    const durationField = findTrialField(engine, 'duration');
    const resolutionField = findTrialField(engine, 'resolution');
    const ratioField = findTrialField(engine, 'aspect_ratio');
    const audioField = findTrialField(engine, 'generate_audio');
    if (
      durationField?.type !== 'enum'
      || !durationField.values?.some((value) => value === String(MCP_TRIAL_PRESET.durationSec))
      || resolutionField?.type !== 'enum'
      || !resolutionField.values?.includes(MCP_TRIAL_PRESET.resolution)
      || ratioField?.type !== 'enum'
      || !MCP_TRIAL_PRESET.aspectRatios.every((ratio) => ratioField.values?.includes(ratio))
      || audioField?.type !== 'boolean'
    ) {
      unsupported('input_schema_caps');
    }

    const requiredFields = engine.inputSchema.required;
    const conditionallyRequiredFields = engine.inputSchema.optional.filter((field) =>
      field.requiredInModes?.includes(MCP_TRIAL_PRESET.mode),
    );
    if (
      [...requiredFields, ...conditionallyRequiredFields].some((field) =>
        fieldAppliesToTrial(field) && MEDIA_FIELD_TYPES.has(field.type),
      )
    ) {
      unsupported('reference_required');
    }

    assertAudioPricingStable(engine);
  } catch (error) {
    if (error instanceof TrialPresetUnsupportedError) throw error;
    throw new TrialPresetUnsupportedError('catalog_malformed');
  }
}
