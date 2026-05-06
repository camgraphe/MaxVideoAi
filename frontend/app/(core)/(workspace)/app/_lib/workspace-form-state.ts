import type { EngineInputField, Mode } from '@/types/engines';

export interface FormState {
  engineId: string;
  mode: Mode;
  durationSec: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  resolution: string;
  aspectRatio: string;
  fps: number;
  iterations: number;
  seedLocked?: boolean;
  loop?: boolean;
  audio: boolean;
  seed?: number | null;
  cameraFixed?: boolean;
  safetyChecker?: boolean;
  extraInputValues: Record<string, unknown>;
}

export type StoredFormState = Partial<FormState> & { engineId: string; mode: Mode; updatedAt?: number };

export function coerceStoredExtraInputValues(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    if (!key.trim()) return acc;
    if (
      entry === null ||
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      (Array.isArray(entry) &&
        entry.every(
          (item) => item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
        ))
    ) {
      acc[key] = entry;
    }
    return acc;
  }, {});
}

export function normalizeExtraInputValue(field: EngineInputField, value: unknown): unknown {
  if (value == null) return undefined;
  if (field.type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
  if (field.type === 'enum') {
    const raw = typeof value === 'number' ? value : typeof value === 'string' ? value.trim() : '';
    if (raw === '') return undefined;
    return raw;
  }
  if (field.type === 'text') {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  return undefined;
}

export function parseStoredForm(value: string): StoredFormState | null {
  try {
    const raw = JSON.parse(value) as StoredFormState | null;
    if (!raw || typeof raw !== 'object') return null;

    const {
      engineId,
      mode,
      durationSec,
      durationOption,
      numFrames,
      resolution,
      aspectRatio,
      fps,
      iterations,
      seedLocked,
      loop,
      audio,
      seed,
      cameraFixed,
      safetyChecker,
      extraInputValues,
      updatedAt,
    } = raw;

    if (typeof engineId !== 'string' || typeof mode !== 'string') return null;

    return {
      engineId,
      mode: mode as Mode,
      durationSec: typeof durationSec === 'number' && Number.isFinite(durationSec) ? durationSec : undefined,
      durationOption:
        typeof durationOption === 'number' || typeof durationOption === 'string'
          ? durationOption
          : undefined,
      numFrames:
        typeof numFrames === 'number' && Number.isFinite(numFrames) && numFrames > 0
          ? Math.round(numFrames)
          : undefined,
      resolution: typeof resolution === 'string' ? resolution : undefined,
      aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : undefined,
      fps: typeof fps === 'number' && Number.isFinite(fps) ? fps : undefined,
      iterations: typeof iterations === 'number' && iterations > 0 ? iterations : undefined,
      seedLocked: typeof seedLocked === 'boolean' ? seedLocked : undefined,
      loop: typeof loop === 'boolean' ? loop : undefined,
      audio: typeof audio === 'boolean' ? audio : undefined,
      seed: typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) : undefined,
      cameraFixed: typeof cameraFixed === 'boolean' ? cameraFixed : undefined,
      safetyChecker: typeof safetyChecker === 'boolean' ? safetyChecker : undefined,
      extraInputValues: coerceStoredExtraInputValues(extraInputValues),
      updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : undefined,
    };
  } catch {
    return null;
  }
}
