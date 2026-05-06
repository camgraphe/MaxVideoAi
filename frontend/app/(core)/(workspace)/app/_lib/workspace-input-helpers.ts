import type { MultiPromptScene } from '@/components/Composer';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { SharedVideoPreview } from '@/lib/video-preview-group';

export const MULTI_PROMPT_MIN_SEC = 3;
export const MULTI_PROMPT_MAX_SEC = 15;

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createMultiPromptScene(): MultiPromptScene {
  return {
    id: createLocalId('scene'),
    prompt: '',
    duration: 5,
  };
}

export function buildMultiPromptSummary(scenes: MultiPromptScene[]): string {
  return scenes
    .filter((scene) => scene.prompt.trim().length)
    .map((scene, index) => `Scene ${index + 1}: ${scene.prompt.trim()}`)
    .join(' | ');
}

export function createKlingElement(): KlingElementState {
  return {
    id: createLocalId('element'),
    frontal: null,
    references: Array.from({ length: 3 }, () => null),
    video: null,
  };
}

export function normalizeSharedVideoPayload(raw: SharedVideoPreview): SharedVideoPreview {
  const durationSec = coerceNumber(raw.durationSec) ?? 0;
  return {
    ...raw,
    durationSec,
  };
}
