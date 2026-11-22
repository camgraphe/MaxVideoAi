import { seedanceAutomaticDurationBounds } from './seedance-source-framing';
import { CANONICAL_SETTING_BY_FIELD_ID } from './canonical-setting-fields';
import { validateGptImage2CustomImageSize } from './image/gptImage2';
import {
  VIDEO_PROVIDER_MAX_SEED,
  getVideoSchemaControlConstraintViolation,
} from '../src/lib/video-input-schema';
import type { EngineInputSchema } from '../types/engines';
import type { MobileSettingField, ModeControls, SettingValue } from './mobile-generation-contract';

type Values = Record<string, SettingValue>;
type ScalarField = {
  id: string;
  type: string;
  label?: string;
  modes?: readonly string[];
  requiredInModes?: readonly string[];
  values?: readonly string[];
  default?: SettingValue;
  min?: number;
  max?: number;
  step?: number;
};
type SettingsEngine = {
  id: string;
  inputSchema?: {
    required?: readonly ScalarField[];
    optional?: readonly ScalarField[];
    constraints?: object;
  };
};
// These fields require the dedicated reference/shot editors. Picking a scalar alone cannot supply the asset bindings.
const referenceSettings = new Set([
  'keyframeIndexes',
  'editKeyframeIndexes',
  'middleFrameTime',
  'multiPrompt',
  'documentUrl',
  'webpageUrl',
]);
export function projectMobileModelSettings(
  engine: SettingsEngine,
  rawMode: string,
  control: ModeControls,
  caps: {
    fps?: number | readonly number[];
    duration?: { options?: readonly (number | string)[] } | { min: number };
  },
): ModeControls {
  const declared = [
    ...(engine.inputSchema?.required ?? []).map((field) => ({ field, required: true })),
    ...(engine.inputSchema?.optional ?? []).map((field) => ({ field, required: false })),
  ].filter(({ field }) => !field.modes?.length || field.modes.includes(rawMode));
  const fields: MobileSettingField[] = [];
  for (const { field, required } of declared) {
    const key =
      field.id === 'mode' && rawMode === 'extend'
        ? 'extendPosition'
        : CANONICAL_SETTING_BY_FIELD_ID[field.id];
    if (!key || referenceSettings.has(key) || key === 'editFace' || fields.some((f) => f.key === key))
      continue;
    if (field.type !== 'enum' && field.type !== 'boolean' && field.type !== 'number' && field.type !== 'text')
      continue;
    const safetyEnum =
      key === 'safetyChecker' &&
      field.type === 'enum' &&
      field.values?.every((v) => v === 'true' || v === 'false');
    const defaultValue =
      safetyEnum && typeof field.default === 'string' ? field.default === 'true' : field.default;
    fields.push({
      key,
      label: field.label ?? key,
      type: safetyEnum ? 'boolean' : field.type === 'enum' && !field.values?.length ? 'text' : field.type,
      required: field.requiredInModes ? field.requiredInModes.includes(rawMode) : required,
      ...(field.values?.length && !safetyEnum ? { values: [...field.values] } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.max !== undefined ? { max: field.max } : {}),
      ...(field.step !== undefined ? { step: field.step } : {}),
      ...(key === 'seed' && control.mode !== 't2i' && control.mode !== 'i2i'
        ? {
            min: Math.max(field.min ?? 0, 0),
            max: Math.min(field.max ?? VIDEO_PROVIDER_MAX_SEED, VIDEO_PROVIDER_MAX_SEED),
            step: 1,
          }
        : {}),
    });
  }
  const fps = typeof caps.fps === 'number' ? [caps.fps] : caps.fps;
  if (fps?.length) {
    const field = declared.find(({ field }) => field.id === 'fps')?.field;
    const preferred = Number(field?.default);
    fields.unshift({
      key: 'fps',
      label: field?.label ?? 'Frame rate',
      type: 'enum',
      values: [...fps],
      default: fps.includes(preferred) ? preferred : fps[0],
      required: false,
    });
  }
  if (
    seedanceAutomaticDurationBounds(engine.id) &&
    control.durations.length &&
    caps.duration &&
    'options' in caps.duration &&
    caps.duration.options?.includes('auto')
  )
    fields.unshift({
      key: 'durationOption',
      label: 'Automatic duration',
      type: 'enum',
      values: ['auto'],
      required: false,
    });
  const durationLimits: NonNullable<ModeControls['durationLimits']> = [];
  if (engine.inputSchema?.constraints && control.durations.length) {
    const longest = Math.max(...control.durations);
    for (const [key, options] of [
      ['resolution', control.resolutions],
      ['fps', fps ?? []],
    ] as const) {
      for (const value of options) {
        // The site's schema validator owns the provider's dependent resolution and frame-rate limits.
        const issue = getVideoSchemaControlConstraintViolation({
          inputSchema: engine.inputSchema as EngineInputSchema,
          duration: longest,
          [key]: value,
        });
        if (issue) durationLimits.push({ key, value, max: issue.maxDurationSec });
      }
    }
  }
  const defaults = { ...control.defaults };
  const resolution = declared.find(({ field }) => field.id === 'resolution')?.field.default;
  if (typeof resolution === 'string') {
    const allowed = control.resolutions.find((v) => v.toLowerCase() === resolution.toLowerCase());
    if (allowed) defaults.resolution = allowed;
  }
  const projected = {
    ...control,
    settingFields: fields,
    ...(durationLimits.length ? { durationLimits } : {}),
    defaults,
  };
  for (const field of fields) {
    if (field.default !== undefined && fieldActive(field, projected, defaults))
      defaults[field.key] = field.default;
  }
  return projected;
}

function fieldActive(field: MobileSettingField, control: ModeControls, values: Values): boolean {
  if (field.key === 'imageWidth' || field.key === 'imageHeight') return values.resolution === 'custom';
  if (field.key === 'outputCompression')
    return values.outputFormat === 'jpeg' || values.outputFormat === 'webp';
  if (field.key === 'hdr')
    return (
      values.resolution !== '540p' &&
      (control.mode === 'v2v' || values.durationSec !== 10) &&
      values.loop !== true
    );
  if (field.key === 'exrExport') return values.hdr === true;
  if (field.key === 'loop' && control.settingFields?.some((f) => f.key === 'hdr'))
    return values.hdr !== true && values.durationSec !== 10;
  if (
    field.key.startsWith('edit') &&
    field.key !== 'editControlMode' &&
    control.settingFields?.some((f) => f.key === 'editControlMode')
  )
    return values.editControlMode === 'manual';
  return true;
}

export function visibleMobileSettingFields(control: ModeControls, values: Values): MobileSettingField[] {
  return (control.settingFields ?? [])
    .filter((field) => fieldActive(field, control, values))
    .map((field) => {
      if (field.key === 'background' && values.outputFormat === 'jpeg')
        return { ...field, values: field.values?.filter((v) => v !== 'transparent') };
      return field;
    });
}

export function mobileDurationOptions(control: ModeControls, settings: Values): number[] {
  const limits = (control.durationLimits ?? []).filter((limit) => settings[limit.key] === limit.value);
  return limits.length
    ? control.durations.filter((d) => limits.every((limit) => d <= limit.max))
    : control.durations;
}

export function validMobileValue(field: MobileSettingField, value: SettingValue): boolean {
  if (field.values?.length) return field.values.includes(value);
  if (field.type === 'number') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < (field.min ?? -Infinity) ||
      value > (field.max ?? Infinity)
    )
      return false;
    const units = (value - (field.min ?? 0)) / (field.step ?? 1);
    return !field.step || Math.abs(units - Math.round(units)) < 1e-9;
  }
  return field.type === 'boolean'
    ? typeof value === 'boolean'
    : typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
}

export function updateMobileSetting(
  control: ModeControls,
  current: Values,
  key: string,
  value: SettingValue | undefined,
): Values {
  const next = { ...current };
  if (value === undefined) delete next[key];
  else next[key] = value;
  if (key === 'durationSec') delete next.durationOption;
  if (key === 'durationOption' && value === 'auto' && control.durations.length)
    next.durationSec = Math.max(...control.durations);
  const durations = mobileDurationOptions(control, next);
  if (typeof next.durationSec === 'number' && durations.length && !durations.includes(next.durationSec)) {
    const requested = next.durationSec;
    next.durationSec = durations.reduce((best, n) =>
      Math.abs(requested - n) < Math.abs(requested - best) ? n : best,
    );
  }
  for (const field of control.settingFields ?? []) {
    if (!fieldActive(field, control, next)) delete next[field.key];
    else if (field.key === 'background' && next.outputFormat === 'jpeg' && next.background === 'transparent')
      next.background = field.default ?? 'auto';
    else if (
      (field.key === 'imageWidth' || field.key === 'imageHeight') &&
      next[field.key] === undefined &&
      field.default !== undefined
    )
      next[field.key] = field.default;
  }
  return next;
}

export function validMobileSettings(control: ModeControls, values: Values): boolean {
  const active = visibleMobileSettingFields(control, values);
  const durations = mobileDurationOptions(control, values);
  if (values.durationOption === 'auto' && values.durationSec !== Math.max(...durations)) return false;
  for (const [key, value] of Object.entries(values)) {
    if (key === 'durationSec' && typeof value === 'number' && durations.includes(value)) continue;
    if (key === 'resolution' && typeof value === 'string' && control.resolutions.includes(value)) continue;
    if (key === 'aspectRatio' && typeof value === 'string' && control.aspectRatios.includes(value)) continue;
    if (key === 'audio' && typeof value === 'boolean' && control.audio === 'optional') continue;
    const field = active.find((f) => f.key === key);
    if (field && validMobileValue(field, value)) continue;
    if (
      !control.settingFields &&
      !['durationSec', 'resolution', 'aspectRatio', 'audio'].includes(key) &&
      Object.hasOwn(control.defaults, key) &&
      control.defaults[key] === value
    )
      continue;
    return false;
  }
  if (
    values.resolution === 'custom' &&
    !validateGptImage2CustomImageSize({ width: values.imageWidth, height: values.imageHeight }).ok
  )
    return false;
  return active.every((f) => !f.required || values[f.key] !== undefined);
}

/** Drop an inactive catalog default while preserving an explicitly submitted incompatible value for rejection. */
export function selectedMobileSettings(control: ModeControls, input: Values): Values {
  const values = { ...control.defaults, ...input };
  for (const field of control.settingFields ?? [])
    if (!Object.hasOwn(input, field.key) && !fieldActive(field, control, values)) delete values[field.key];
  return values;
}
