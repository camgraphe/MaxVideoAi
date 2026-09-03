import type { EngineCaps, EngineInputSchema, EngineModeDurationCaps, EngineModeUiCaps, Mode } from '@/types/engines';

function getActiveEnumField(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
  fieldId: string,
) {
  return [...(inputSchema?.required ?? []), ...(inputSchema?.optional ?? [])].find((field) => (
    field.id === fieldId
    && field.type === 'enum'
    && (!field.modes?.length || field.modes.includes(mode))
  ));
}

export function getRuntimeSchemaEnumDefault(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
  fieldId: string,
): string | undefined {
  const value = getActiveEnumField(inputSchema, mode, fieldId)?.default;
  return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

export function getRuntimeDurationDefault(
  capability: EngineModeUiCaps | undefined,
  fallback: number,
): number {
  const value = capability?.duration?.default;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?s?$/iu.test(value)) {
    return Number(value.replace(/s$/iu, ''));
  }
  return fallback;
}

export function deriveRuntimeSchemaCaps(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
): EngineModeUiCaps | undefined {
  if (!inputSchema) return undefined;
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  const durationField = getActiveEnumField(inputSchema, mode, 'duration');
  const resolutionField = getActiveEnumField(inputSchema, mode, 'resolution');
  const aspectRatioField = getActiveEnumField(inputSchema, mode, 'aspect_ratio');
  const durationDefault = durationField?.default;
  return {
    modes: [mode],
    ...(durationField?.values?.length
      ? {
          duration: {
            options: [...durationField.values],
            ...(typeof durationDefault === 'string' || typeof durationDefault === 'number'
              ? { default: durationDefault }
              : {}),
          },
        }
      : {}),
    ...(resolutionField?.values?.length ? { resolution: [...resolutionField.values] } : {}),
    ...(aspectRatioField?.values?.length ? { aspectRatio: [...aspectRatioField.values] } : {}),
    audioToggle: fields.some((field) => (
      field.type === 'boolean'
      && (field.id === 'audio' || field.id === 'generate_audio')
      && (!field.modes?.length || field.modes.includes(mode))
    )),
  };
}

export type RuntimeRequestSettingsValidation =
  | { ok: true }
  | {
      ok: false;
      error: {
        code: 'ENGINE_CONSTRAINT';
        field: 'durationSec' | 'resolution' | 'aspectRatio' | 'fps';
        message: string;
        allowed: Array<string | number>;
        value: unknown;
      };
    };

function normalizeDuration(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?s?$/iu.test(normalized)) return null;
  const parsed = Number(normalized.replace(/s$/iu, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function durationAllowed(
  value: unknown,
  capability: EngineModeDurationCaps,
  maxDurationSec: number,
): { valid: boolean; allowed: Array<string | number> } {
  const normalized = normalizeDuration(value);
  if ('options' in capability) {
    return {
      valid: normalized !== null && capability.options.some((option) => normalizeDuration(option) === normalized),
      allowed: [...capability.options],
    };
  }
  return {
    valid: normalized !== null && normalized >= capability.min && normalized <= maxDurationSec,
    allowed: [`${capability.min}-${maxDurationSec}`],
  };
}

function failure(
  field: Extract<RuntimeRequestSettingsValidation, { ok: false }>['error']['field'],
  value: unknown,
  allowed: Array<string | number>,
): RuntimeRequestSettingsValidation {
  return {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field,
      message: `This engine does not support the selected ${field}.`,
      allowed,
      value,
    },
  };
}

export function validateRuntimeRequestSettings(input: {
  engine: EngineCaps;
  mode: Mode;
  durationSec?: unknown;
  resolution?: unknown;
  aspectRatio?: unknown;
  fps?: unknown;
}): RuntimeRequestSettingsValidation {
  const capability = input.engine.modeCaps?.[input.mode]
    ?? deriveRuntimeSchemaCaps(input.engine.inputSchema, input.mode);

  if (input.durationSec !== undefined) {
    if (!capability?.duration) return failure('durationSec', input.durationSec, []);
    const decision = durationAllowed(input.durationSec, capability.duration, input.engine.maxDurationSec);
    if (!decision.valid) return failure('durationSec', input.durationSec, decision.allowed);
  }

  if (input.resolution !== undefined) {
    const allowed = capability?.resolution ?? [];
    if (typeof input.resolution !== 'string' || !allowed.includes(input.resolution)) {
      return failure('resolution', input.resolution, [...allowed]);
    }
  }

  if (input.aspectRatio !== undefined) {
    const allowed = capability?.aspectRatio ?? [];
    if (typeof input.aspectRatio !== 'string' || !allowed.includes(input.aspectRatio)) {
      return failure('aspectRatio', input.aspectRatio, [...allowed]);
    }
  }

  if (input.fps !== undefined) {
    const allowed = Array.isArray(capability?.fps)
      ? capability.fps
      : typeof capability?.fps === 'number'
        ? [capability.fps]
        : input.engine.fps;
    if (typeof input.fps !== 'number' || !Number.isFinite(input.fps) || !allowed.includes(input.fps)) {
      return failure('fps', input.fps, [...allowed]);
    }
  }

  return { ok: true };
}
