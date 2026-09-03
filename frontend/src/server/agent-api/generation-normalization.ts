import { createHash } from 'node:crypto';

import type {
  CanonicalGenerationMode,
  CanonicalGenerationMultiPromptScene,
  CanonicalGenerationReference,
  CanonicalGenerationReferenceRole,
  CanonicalReferenceMediaKind,
  CanonicalGenerationRequest,
  CanonicalGenerationSettingValue,
  CanonicalGenerationSurface,
} from './generation-types';
import {
  CANONICAL_GENERATION_MODES,
  CANONICAL_IMAGE_GENERATION_MODES,
  CANONICAL_VIDEO_GENERATION_MODES,
} from './generation-types';
import {
  MAX_CONTROLLED_REFERENCE_URL_CHARS,
  normalizeControlledHttpsReferenceUrl,
} from './controlled-reference-url';

export const MAX_CANONICAL_PROMPT_CHARS = 12_000;
export const MAX_CANONICAL_SETTING_COUNT = 64;
export const MAX_CANONICAL_SETTING_STRING_CHARS = 4_096;
export const MAX_CANONICAL_SETTINGS_JSON_BYTES = 16_384;
export const MAX_CANONICAL_REFERENCES = 50;
export const MAX_CANONICAL_REFERENCE_URL_CHARS = MAX_CONTROLLED_REFERENCE_URL_CHARS;

const MAX_ENGINE_ID_CHARS = 128;
const MAX_ASSET_ID_CHARS = 256;
const MAX_SETTING_KEY_CHARS = 64;
const MODE_SET = new Set<CanonicalGenerationMode>(CANONICAL_GENERATION_MODES);
const VIDEO_MODE_SET = new Set<CanonicalGenerationMode>(CANONICAL_VIDEO_GENERATION_MODES);
const IMAGE_MODE_SET = new Set<CanonicalGenerationMode>(CANONICAL_IMAGE_GENERATION_MODES);
const REFERENCE_MEDIA_KIND_SET = new Set<CanonicalReferenceMediaKind>(['image', 'video', 'audio']);
const ROLE_SET = new Set<CanonicalGenerationReferenceRole>([
  'source',
  'reference',
  'first_frame',
  'last_frame',
  'mask',
]);
const ROLE_ORDER: Record<CanonicalGenerationReferenceRole, number> = {
  source: 0,
  first_frame: 1,
  last_frame: 2,
  reference: 3,
  mask: 4,
};
const TOP_LEVEL_FIELDS = new Set([
  'schemaVersion',
  'surface',
  'engineId',
  'mode',
  'prompt',
  'settings',
  'references',
  'outputCount',
]);
const ASSET_REFERENCE_FIELDS = new Set(['kind', 'assetId', 'role']);
const HTTPS_REFERENCE_FIELDS = new Set(['kind', 'url', 'role', 'mediaKind']);
const ORDERED_ASSET_REFERENCE_FIELDS = new Set([...ASSET_REFERENCE_FIELDS, 'slot']);
const ORDERED_HTTPS_REFERENCE_FIELDS = new Set([...HTTPS_REFERENCE_FIELDS, 'slot']);
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SAFE_SETTING_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/;
const UNSAFE_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const VIDEO_SETTING_KEYS = new Set([
  'aspectRatio',
  'audio',
  'cameraFixed',
  'cfgScale',
  'contextSec',
  'cropEndX',
  'cropEndY',
  'cropStartX',
  'cropStartY',
  'durationSec',
  'fps',
  'guidanceScale',
  'hdr',
  'loop',
  'negativePrompt',
  'numFrames',
  'resolution',
  'reframeGridPositionX',
  'reframeGridPositionY',
  'retakeMode',
  'safetyChecker',
  'seed',
  'shotType',
  'sourcePositionHeight',
  'sourcePositionWidth',
  'sourcePositionX',
  'sourcePositionY',
  'startTimeSec',
  'extendPosition',
  'modifyStrength',
  'multiPrompt',
  'exrExport',
  'editDepthBlur',
  'editFace',
  'editKeyframeIndexes',
  'editNormalsAugmentation',
  'editPoseStrength',
  'editStrength',
  'editTrajectorySparsity',
]);
const IMAGE_SETTING_KEYS = new Set([
  'aspectRatio',
  'enableWebSearch',
  'limitGenerations',
  'imageHeight',
  'imageWidth',
  'outputFormat',
  'quality',
  'resolution',
  'seed',
  'style',
  'thinkingLevel',
  'watermark',
]);
const SETTING_KEYS_BY_MODE: Record<CanonicalGenerationMode, ReadonlySet<string>> = {
  t2v: VIDEO_SETTING_KEYS,
  i2v: VIDEO_SETTING_KEYS,
  i2v_standard: VIDEO_SETTING_KEYS,
  ref2v: VIDEO_SETTING_KEYS,
  fl2v: VIDEO_SETTING_KEYS,
  v2v: VIDEO_SETTING_KEYS,
  r2v: VIDEO_SETTING_KEYS,
  extend: VIDEO_SETTING_KEYS,
  a2v: VIDEO_SETTING_KEYS,
  retake: VIDEO_SETTING_KEYS,
  reframe: VIDEO_SETTING_KEYS,
  t2i: IMAGE_SETTING_KEYS,
  i2i: IMAGE_SETTING_KEYS,
};

export class GenerationNormalizationError extends Error {
  constructor(
    readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'GenerationNormalizationError';
  }
}

function fail(field: string, message: string): never {
  throw new GenerationNormalizationError(field, message);
}

function assertPlainDataObject(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(field, `${field} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(field, `${field} must not use a custom prototype.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      fail(field, `${field} contains an unsupported field.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(field, `${field} must contain enumerable data fields only.`);
    }
  }
}

function assertExactFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, field: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      fail(field, `${field} contains an unknown or unsupported field.`);
    }
  }
}

function assertDenseDataArray(value: unknown, field: string, maxLength: number): asserts value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail(field, `${field} must be a plain array.`);
  }
  if (value.length > maxLength) {
    fail(field, `${field} exceeds its item limit.`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      fail(field, `${field} must be a dense array.`);
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length) {
      fail(field, `${field} contains an unknown field.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      fail(field, `${field} must contain enumerable data items only.`);
    }
  }
}

function normalizeWhitespace(value: string): string {
  return value.normalize('NFC').trim().replace(/[\s\uFEFF]+/gu, ' ');
}

function normalizeText(value: unknown, field: string, maxChars: number, allowEmpty: boolean): string {
  if (typeof value !== 'string') {
    fail(field, `${field} must be a string.`);
  }
  const normalized = normalizeWhitespace(value);
  if ((!allowEmpty && normalized.length === 0) || normalized.length > maxChars) {
    fail(field, `${field} has an invalid length.`);
  }
  if (UNSAFE_CONTROL_CHARACTER_PATTERN.test(normalized)) {
    fail(field, `${field} contains unsupported control characters.`);
  }
  return normalized;
}

function normalizeToken(value: unknown, field: string): string {
  return normalizeText(value, field, MAX_SETTING_KEY_CHARS, false);
}

function normalizeSurface(value: unknown): CanonicalGenerationSurface {
  const surface = normalizeToken(value, 'surface');
  if (surface !== 'video' && surface !== 'image') {
    fail('surface', 'surface must be video or image.');
  }
  return surface;
}

function normalizeMode(value: unknown): CanonicalGenerationMode {
  const mode = normalizeToken(value, 'mode') as CanonicalGenerationMode;
  if (!MODE_SET.has(mode)) {
    fail('mode', 'mode is unsupported.');
  }
  return mode;
}

function normalizeEngineId(value: unknown): string {
  const engineId = normalizeText(value, 'engineId', MAX_ENGINE_ID_CHARS, false);
  if (!SAFE_ID_PATTERN.test(engineId)) {
    fail('engineId', 'engineId contains unsupported characters.');
  }
  return engineId;
}

function normalizeSettingKey(value: string, allowedKeys: ReadonlySet<string>): string {
  const key = normalizeText(value, 'settings key', MAX_SETTING_KEY_CHARS, false);
  if (!SAFE_SETTING_KEY_PATTERN.test(key) || !allowedKeys.has(key)) {
    fail('settings', 'settings contains an unknown or unsupported field.');
  }
  return key;
}

function normalizeSettingValue(value: unknown, key: string): CanonicalGenerationSettingValue {
  if (key === 'multiPrompt') {
    assertDenseDataArray(value, 'settings.multiPrompt', 6);
    if (value.length === 0) fail('settings.multiPrompt', 'multiPrompt must contain at least one scene.');
    return value.map((entry, index): CanonicalGenerationMultiPromptScene => {
      const field = `settings.multiPrompt[${index}]`;
      assertPlainDataObject(entry, field);
      assertExactFields(entry, new Set(['prompt', 'durationSec']), field);
      const prompt = normalizeText(entry.prompt, `${field}.prompt`, 512, false);
      const durationSec = entry.durationSec;
      if (!Number.isSafeInteger(durationSec) || (durationSec as number) < 1 || (durationSec as number) > 15) {
        fail(`${field}.durationSec`, 'multiPrompt durationSec must be an integer from 1 through 15.');
      }
      return { prompt, durationSec: durationSec as number };
    });
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail(`settings.${key}`, 'settings values must be finite scalars.');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'string') {
    return normalizeText(value, `settings.${key}`, MAX_CANONICAL_SETTING_STRING_CHARS, true);
  }
  fail(`settings.${key}`, 'settings contains an invalid value.');
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Stable JSON accepts finite numbers only.');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('Stable JSON accepts JSON values only.');
}

function normalizeSettings(
  value: unknown,
  mode: CanonicalGenerationMode
): Record<string, CanonicalGenerationSettingValue> {
  if (value === undefined) return {};
  assertPlainDataObject(value, 'settings');
  const rawKeys = Object.keys(value);
  if (rawKeys.length > MAX_CANONICAL_SETTING_COUNT) {
    fail('settings', 'settings contains too many fields.');
  }

  const settings: Record<string, CanonicalGenerationSettingValue> = {};
  const allowedKeys = SETTING_KEYS_BY_MODE[mode];
  for (const rawKey of rawKeys) {
    const key = normalizeSettingKey(rawKey, allowedKeys);
    if (Object.hasOwn(settings, key)) {
      fail('settings', 'settings contains duplicate canonical keys.');
    }
    settings[key] = normalizeSettingValue(value[rawKey], key);
  }

  const ordered = Object.fromEntries(
    Object.entries(settings).sort(([left], [right]) => compareCodeUnits(left, right))
  ) as Record<string, CanonicalGenerationSettingValue>;
  if (Buffer.byteLength(stableJson(ordered), 'utf8') > MAX_CANONICAL_SETTINGS_JSON_BYTES) {
    fail('settings', 'settings exceeds the canonical size limit.');
  }
  return ordered;
}

function normalizeReferenceRole(value: unknown, index: number): CanonicalGenerationReferenceRole {
  const role = normalizeToken(value, `references[${index}].role`) as CanonicalGenerationReferenceRole;
  if (!ROLE_SET.has(role)) {
    fail(`references[${index}].role`, 'reference role is unsupported.');
  }
  return role;
}

function normalizeReferenceMediaKind(value: unknown, index: number): CanonicalReferenceMediaKind {
  const mediaKind = normalizeToken(
    value,
    `references[${index}].mediaKind`,
  ) as CanonicalReferenceMediaKind;
  if (!REFERENCE_MEDIA_KIND_SET.has(mediaKind)) {
    fail(`references[${index}].mediaKind`, 'reference mediaKind is unsupported.');
  }
  return mediaKind;
}

function normalizeAssetId(value: unknown, index: number): string {
  const field = `references[${index}].assetId`;
  const assetId = normalizeText(value, field, MAX_ASSET_ID_CHARS, false);
  if (!SAFE_ID_PATTERN.test(assetId)) {
    fail(field, 'reference assetId contains unsupported characters.');
  }
  return assetId;
}

function normalizeHttpsUrl(value: unknown, index: number): string {
  const field = `references[${index}].url`;
  const rawUrl = normalizeText(value, field, MAX_CANONICAL_REFERENCE_URL_CHARS, false);
  try {
    return normalizeControlledHttpsReferenceUrl(rawUrl);
  } catch {
    fail(field, 'reference URL must use the controlled HTTPS format.');
  }
}

function normalizeReference(
  value: unknown,
  index: number,
  orderedRole: CanonicalGenerationReferenceRole | null,
): CanonicalGenerationReference {
  const field = `references[${index}]`;
  assertPlainDataObject(value, field);
  const kind = normalizeToken(value.kind, `${field}.kind`);
  const role = normalizeReferenceRole(value.role, index);
  if (kind === 'asset') {
    assertExactFields(
      value,
      role === orderedRole ? ORDERED_ASSET_REFERENCE_FIELDS : ASSET_REFERENCE_FIELDS,
      field,
    );
    return { kind, assetId: normalizeAssetId(value.assetId, index), role };
  }
  if (kind === 'https') {
    assertExactFields(
      value,
      role === orderedRole ? ORDERED_HTTPS_REFERENCE_FIELDS : HTTPS_REFERENCE_FIELDS,
      field,
    );
    return {
      kind,
      url: normalizeHttpsUrl(value.url, index),
      role,
      mediaKind: normalizeReferenceMediaKind(value.mediaKind, index),
    };
  }
  fail(`${field}.kind`, 'reference kind must be asset or https.');
}

function referenceIdentity(reference: CanonicalGenerationReference): string {
  const source = reference.kind === 'asset' ? reference.assetId : reference.url;
  const mediaKind = reference.kind === 'https' ? reference.mediaKind : '';
  return `${reference.role}\u0000${reference.kind}\u0000${mediaKind}\u0000${source}\u0000${reference.slot ?? ''}`;
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareReferences(left: CanonicalGenerationReference, right: CanonicalGenerationReference): number {
  const roleDifference = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
  if (!roleDifference && left.slot !== undefined && right.slot !== undefined) {
    return left.slot - right.slot;
  }
  return roleDifference || compareCodeUnits(referenceIdentity(left), referenceIdentity(right));
}

function normalizeReferences(
  value: unknown,
  mode: CanonicalGenerationMode,
): CanonicalGenerationReference[] {
  if (value === undefined) return [];
  assertDenseDataArray(value, 'references', MAX_CANONICAL_REFERENCES);
  const orderedRole = mode === 'extend'
    ? 'source'
    : mode === 'r2v' || mode === 'v2v'
      ? 'reference'
      : null;
  let nextOrderedSlot = 0;
  const references = value.map((reference, index) => {
    const normalized = normalizeReference(reference, index, orderedRole);
    if (normalized.role !== orderedRole) return normalized;
    const slot = nextOrderedSlot;
    nextOrderedSlot += 1;
    const authoredSlot = (reference as Record<string, unknown>).slot;
    if (authoredSlot !== undefined && authoredSlot !== slot) {
      fail(`references[${index}].slot`, 'ordered reference slot does not match caller order.');
    }
    return { ...normalized, slot };
  }).sort(compareReferences);
  const identities = new Set<string>();
  for (const reference of references) {
    const identity = referenceIdentity(reference);
    if (identities.has(identity)) {
      fail('references', 'duplicate canonical reference.');
    }
    identities.add(identity);
  }
  return references;
}

function assertSurfaceMode(surface: CanonicalGenerationSurface, mode: CanonicalGenerationMode): void {
  const supported = surface === 'video' ? VIDEO_MODE_SET.has(mode) : IMAGE_MODE_SET.has(mode);
  if (!supported) {
    fail('mode', 'surface and mode are incompatible.');
  }
}

function normalizeOutputCount(
  value: unknown,
  surface: CanonicalGenerationSurface,
): number {
  if (value === undefined) return 1;
  const maximum = surface === 'image' ? 15 : 1;
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 1
    || value > maximum
  ) {
    fail('outputCount', `outputCount must be an integer from 1 to ${maximum}.`);
  }
  return value;
}

export function normalizeGenerationRequest(input: unknown): CanonicalGenerationRequest {
  assertPlainDataObject(input, 'generation request');
  assertExactFields(input, TOP_LEVEL_FIELDS, 'generation request');
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) {
    fail('schemaVersion', 'schemaVersion must be 1.');
  }

  const surface = normalizeSurface(input.surface);
  const mode = normalizeMode(input.mode);
  assertSurfaceMode(surface, mode);

  const settings = normalizeSettings(input.settings, mode);
  const prompt = normalizeText(input.prompt, 'prompt', MAX_CANONICAL_PROMPT_CHARS, true);
  if (!prompt && !Array.isArray(settings.multiPrompt)) {
    fail('prompt', 'prompt has an invalid length.');
  }
  return {
    schemaVersion: 1,
    surface,
    engineId: normalizeEngineId(input.engineId),
    mode,
    prompt,
    settings,
    references: normalizeReferences(input.references, mode),
    outputCount: normalizeOutputCount(input.outputCount, surface),
  };
}

export function serializeCanonicalGenerationRequest(request: CanonicalGenerationRequest): string {
  return stableJson(normalizeGenerationRequest(request));
}

export function hashCanonicalGenerationRequest(request: CanonicalGenerationRequest): string {
  const canonicalRequest = normalizeGenerationRequest(request);
  const canonicalJson = stableJson(canonicalRequest);
  return createHash('sha256')
    .update(`${canonicalRequest.schemaVersion}${canonicalJson}`, 'utf8')
    .digest('hex');
}
