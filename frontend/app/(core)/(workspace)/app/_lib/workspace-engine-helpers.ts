import { isLumaRay2EngineId, isLumaRay2GenerateMode } from '@/lib/luma-ray2';
import { getLocalizedModeLabel } from '@/lib/ltx-localization';
import type { EngineCaps, EngineInputField, EngineModeUiCaps, Mode } from '@/types/engines';
import type { FormState } from './workspace-form-state';

export function normalizeEngineToken(value?: string | null): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function matchesEngineToken(engine: EngineCaps, token: string): boolean {
  if (!token) return false;
  if (normalizeEngineToken(engine.id) === token) return true;
  if (normalizeEngineToken(engine.label) === token) return true;
  const slug = normalizeEngineToken(engine.providerMeta?.modelSlug);
  if (slug && slug === token) return true;
  return false;
}

type DurationOptionMeta = {
  raw: number | string;
  value: number;
  label: string;
  isAuto?: boolean;
};

function parseDurationOptionValue(option: number | string): DurationOptionMeta {
  if (typeof option === 'number') {
    return {
      raw: option,
      value: option,
      label: `${option}s`,
    };
  }
  if (option.trim().toLowerCase() === 'auto') {
    return {
      raw: option,
      value: 0,
      label: option,
      isAuto: true,
    };
  }
  const numeric = Number(option.replace(/[^\d.]/g, ''));
  return {
    raw: option,
    value: Number.isFinite(numeric) ? numeric : 0,
    label: option,
  };
}

function matchesDurationOption(
  meta: DurationOptionMeta,
  previousOption: number | string | null | undefined,
  previousSeconds: number | null | undefined
): boolean {
  if (previousOption != null) {
    if (typeof previousOption === 'number') {
      return Math.abs(meta.value - previousOption) < 0.001;
    }
    if (typeof previousOption === 'string') {
      if (previousOption === meta.raw || previousOption === meta.label) return true;
      const previousNumeric = Number(previousOption.replace(/[^\d.]/g, ''));
      if (Number.isFinite(previousNumeric)) {
        return Math.abs(meta.value - previousNumeric) < 0.001;
      }
    }
  }
  if (previousSeconds != null) {
    return Math.abs(meta.value - previousSeconds) < 0.001;
  }
  return false;
}

export function normalizeFieldId(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const STANDARD_ENGINE_FIELD_IDS = new Set([
  'prompt',
  'negativeprompt',
  'duration',
  'durationseconds',
  'resolution',
  'aspectratio',
  'fps',
  'generateaudio',
  'seed',
  'camerafixed',
  'enablesafetychecker',
  'cfgscale',
  'loop',
]);

export const PROMOTED_WORKFLOW_FIELD_IDS = new Set(['enhanceprompt', 'autofix']);

export function isModeValue(value: unknown): value is Mode {
  return (
    value === 't2v' ||
    value === 'i2v' ||
    value === 'v2v' ||
    value === 'ref2v' ||
    value === 'fl2v' ||
    value === 'r2v' ||
    value === 'a2v' ||
    value === 'extend' ||
    value === 'retake' ||
    value === 'reframe' ||
    value === 't2i' ||
    value === 'i2i'
  );
}

export function getEngineModeLabel(engineId: string | null | undefined, mode: Mode, locale?: string | null): string {
  if (engineId === 'happy-horse-1-0' && mode === 'ref2v') {
    return 'R2V';
  }
  return getLocalizedModeLabel(mode, locale);
}

export function parseBooleanInput(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'off'].includes(trimmed)) return false;
  }
  return null;
}

export function findInputFieldById(engine: EngineCaps, mode: Mode, fieldId: string): EngineInputField | null {
  const schema = engine.inputSchema;
  if (!schema) return null;
  const normalizedTarget = normalizeFieldId(fieldId);
  const fields = [...(schema.required ?? []), ...(schema.optional ?? [])];
  return (
    fields.find((field) => {
      const id = normalizeFieldId(field.id);
      if (id !== normalizedTarget) return false;
      return !field.modes || field.modes.includes(mode);
    }) ?? null
  );
}

export function findGenerateAudioField(engine: EngineCaps, mode: Mode): EngineInputField | null {
  return findInputFieldById(engine, mode, 'generate_audio');
}

export function resolveAudioDefault(engine: EngineCaps, mode: Mode): boolean {
  const field = findGenerateAudioField(engine, mode);
  const parsed = parseBooleanInput(field?.default);
  return parsed ?? true;
}

export function resolveBooleanFieldDefault(
  engine: EngineCaps,
  mode: Mode,
  fieldId: string,
  fallback: boolean
): boolean {
  const field = findInputFieldById(engine, mode, fieldId);
  const parsed = parseBooleanInput(field?.default);
  return parsed ?? fallback;
}

export function resolveNumberFieldDefault(engine: EngineCaps, mode: Mode, fieldId: string): number | null {
  const field = findInputFieldById(engine, mode, fieldId);
  const raw = field?.default;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().length) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getPreferredEngineMode(engine: EngineCaps, candidate?: Mode | null): Mode {
  if (candidate && engine.modes.includes(candidate)) return candidate;
  return engine.modes[0] ?? 't2v';
}

export function getModeCaps(engine: EngineCaps, mode: Mode): EngineModeUiCaps | undefined {
  const exact = engine.modeCaps?.[mode];
  if (exact) return exact;
  return {
    modes: [mode],
    duration: { min: 1, default: engine.maxDurationSec || 1 },
    resolution: engine.resolutions,
    aspectRatio: engine.aspectRatios,
    fps: engine.fps,
    audioToggle: engine.audio,
  };
}

export function framesToSeconds(frames: number): number {
  if (!Number.isFinite(frames) || frames <= 0) return 1;
  return Math.max(1, Math.round(frames / 24));
}

export function coerceFormState(engine: EngineCaps, mode: Mode, previous: FormState | null | undefined): FormState {
  const capability = getModeCaps(engine, mode);
  const isLumaRay2Engine = isLumaRay2EngineId(engine.id);
  const resetFastDefaultsOnEngineSwitch =
    (engine.id === 'ltx-2-fast' || engine.id === 'ltx-2-3-fast') &&
    Boolean(previous?.engineId) &&
    previous?.engineId !== engine.id;
  const previousDurationOption = resetFastDefaultsOnEngineSwitch ? null : previous?.durationOption ?? null;
  const previousDurationSec = resetFastDefaultsOnEngineSwitch ? null : previous?.durationSec ?? null;
  const previousNumFrames = resetFastDefaultsOnEngineSwitch ? null : previous?.numFrames ?? null;
  const previousResolution = resetFastDefaultsOnEngineSwitch ? null : previous?.resolution ?? null;
  const previousFps = resetFastDefaultsOnEngineSwitch ? null : previous?.fps ?? null;

  const durationResult = (() => {
    const prevOption = previousDurationOption;
    const prevSeconds = previousDurationSec;
    const prevFrames = previousNumFrames;
    if (capability?.frames && capability.frames.length) {
      const framesList = capability.frames;
      let selectedFrames = prevFrames && framesList.includes(prevFrames) ? prevFrames : null;
      if (selectedFrames === null && prevSeconds != null) {
        const targetSeconds = Math.max(1, Math.round(prevSeconds));
        selectedFrames = framesList.reduce((best, candidate) => {
          const bestSeconds = framesToSeconds(best);
          const candidateSeconds = framesToSeconds(candidate);
          const bestDiff = Math.abs(bestSeconds - targetSeconds);
          const candidateDiff = Math.abs(candidateSeconds - targetSeconds);
          return candidateDiff < bestDiff ? candidate : best;
        }, framesList[0]);
      }
      if (selectedFrames === null) {
        selectedFrames = framesList[0];
      }
      const durationSec = framesToSeconds(selectedFrames);
      return {
        durationSec,
        durationOption: selectedFrames,
        numFrames: selectedFrames,
      };
    }
    if (capability?.duration) {
      if ('options' in capability.duration) {
        const parsedOptions = capability.duration.options
          .map(parseDurationOptionValue)
          .filter((entry) => entry.isAuto || entry.value > 0);
        const numericOptions = parsedOptions.filter((entry) => !entry.isAuto && entry.value > 0);
        const defaultRaw = capability.duration.default ?? parsedOptions[0]?.raw ?? engine.maxDurationSec;
        const defaultMeta = parseDurationOptionValue(defaultRaw as number | string);
        const fallbackDurationSec =
          prevSeconds != null && prevSeconds > 0
            ? prevSeconds
            : numericOptions.find((meta) => matchesDurationOption(meta, defaultRaw as number | string, defaultMeta.value))
                ?.value ?? numericOptions[0]?.value ?? Math.min(engine.maxDurationSec, 8);
        const closestBySeconds =
          prevSeconds != null && numericOptions.length
            ? numericOptions.reduce((best, candidate) => {
                const bestDiff = Math.abs(best.value - prevSeconds);
                const candidateDiff = Math.abs(candidate.value - prevSeconds);
                return candidateDiff < bestDiff ? candidate : best;
              }, numericOptions[0])
            : null;
        const selected = parsedOptions.find((meta) => matchesDurationOption(meta, prevOption, prevSeconds))
          ?? closestBySeconds
          ?? parsedOptions.find((meta) => matchesDurationOption(meta, defaultRaw as number | string, defaultMeta.value))
          ?? parsedOptions[0]
          ?? defaultMeta;
        const resolvedDurationValue = selected.isAuto ? fallbackDurationSec : selected.value;
        const clampedSeconds = Math.max(1, Math.min(engine.maxDurationSec, Math.round(resolvedDurationValue)));
        return {
          durationSec: clampedSeconds,
          durationOption: selected.raw,
          numFrames: null,
        };
      }
      const min = capability.duration.min;
      const defaultValue = typeof capability.duration.default === 'number' ? capability.duration.default : min;
      const candidate = prevSeconds != null ? Math.max(min, prevSeconds) : defaultValue;
      const clampedSeconds = Math.max(min, Math.min(engine.maxDurationSec, Math.round(candidate)));
      return {
        durationSec: clampedSeconds,
        durationOption: clampedSeconds,
        numFrames: null,
      };
    }
    const fallback = prevSeconds != null ? prevSeconds : Math.min(engine.maxDurationSec, 8);
    return {
      durationSec: Math.max(1, Math.round(fallback)),
      durationOption: fallback,
      numFrames: null,
    };
  })();

  const resolutionOptions = capability?.resolution && capability.resolution.length ? capability.resolution : engine.resolutions;
  const aspectOptions = capability
    ? capability.aspectRatio && capability.aspectRatio.length
      ? capability.aspectRatio
      : []
    : engine.aspectRatios;

  const resolution = (() => {
    if (resolutionOptions.length === 0) {
      return previousResolution ?? engine.resolutions[0] ?? '1080p';
    }
    if (previousResolution && resolutionOptions.includes(previousResolution)) {
      return previousResolution;
    }
    return resolutionOptions[0];
  })();

  const aspectRatio = (() => {
    if (aspectOptions.length === 0) {
      return previous?.aspectRatio ?? 'source';
    }
    const previousAspect = previous?.aspectRatio;
    if (previousAspect && aspectOptions.includes(previousAspect)) {
      return previousAspect;
    }
    return aspectOptions[0];
  })();

  const fpsOptions = (() => {
    if (Array.isArray(capability?.fps)) return capability.fps;
    if (typeof capability?.fps === 'number') return [capability.fps];
    return engine.fps && engine.fps.length ? engine.fps : [24];
  })();
  const fps = (() => {
    if (previousFps && fpsOptions.includes(previousFps)) {
      return previousFps;
    }
    return fpsOptions[0];
  })();

  const iterations = previous?.iterations ? Math.max(1, Math.min(4, previous.iterations)) : 1;
  const loop = isLumaRay2Engine && isLumaRay2GenerateMode(mode) ? Boolean(previous?.loop) : undefined;
  const audio = (() => {
    const previousAudio = typeof previous?.audio === 'boolean' ? previous.audio : null;
    if (previousAudio !== null) return previousAudio;
    return resolveAudioDefault(engine, mode);
  })();
  const seed = (() => {
    const previousSeed = typeof previous?.seed === 'number' && Number.isFinite(previous.seed) ? previous.seed : null;
    if (previousSeed !== null) return previousSeed;
    return resolveNumberFieldDefault(engine, mode, 'seed');
  })();
  const cameraFixed = (() => {
    const previousValue = typeof previous?.cameraFixed === 'boolean' ? previous.cameraFixed : null;
    if (previousValue !== null) return previousValue;
    return resolveBooleanFieldDefault(engine, mode, 'camera_fixed', false);
  })();
  const safetyChecker = (() => {
    const previousValue = typeof previous?.safetyChecker === 'boolean' ? previous.safetyChecker : null;
    if (previousValue !== null) return previousValue;
    return resolveBooleanFieldDefault(engine, mode, 'enable_safety_checker', true);
  })();

  return {
    engineId: engine.id,
    mode,
    durationSec: durationResult.durationSec,
    durationOption: durationResult.durationOption,
    numFrames: durationResult.numFrames ?? undefined,
    resolution,
    aspectRatio,
    fps,
    iterations,
    seedLocked: previous?.seedLocked ?? false,
    loop,
    audio,
    seed,
    cameraFixed,
    safetyChecker,
    extraInputValues: previous?.extraInputValues ?? {},
  };
}
