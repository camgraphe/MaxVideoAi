import type { JobSurface } from '@/types/billing';
import type { Mode } from '@/types/engines';

const STORAGE_KEYS = {
  form: 'maxvideoai.generate.form.v1',
  imageForm: 'maxvideoai.image.composer.v1',
  templates: 'maxvideoai.dashboard.templates.v1',
} as const;

export const MODE_OPTIONS: Mode[] = ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend', 'a2v', 'retake', 'r2v'];
export const IMAGE_MODE_OPTIONS: Mode[] = ['t2i', 'i2i'];

export type TemplateEntry = {
  id: string;
  surface?: JobSurface | null;
  href?: string | null;
  demo?: boolean;
  prompt: string;
  engineLabel?: string | null;
  engineId?: string | null;
  thumbUrl?: string | null;
  durationSec?: number | null;
  aspectRatio?: string | null;
  hasAudio?: boolean | null;
  priceCents?: number | null;
  currency?: string | null;
  createdAt?: string | null;
};

export function readStoredForm(): { engineId: string; mode?: Mode } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEYS.form);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { engineId?: unknown; mode?: unknown };
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.engineId !== 'string') return null;
    const mode = typeof parsed.mode === 'string' && MODE_OPTIONS.includes(parsed.mode as Mode)
      ? (parsed.mode as Mode)
      : undefined;
    return { engineId: parsed.engineId, mode };
  } catch {
    return null;
  }
}

export function readStoredImageForm(): { engineId: string; mode?: Mode } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEYS.imageForm);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { engineId?: unknown; mode?: unknown; version?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.version === 'number' && parsed.version !== 1) return null;
    if (typeof parsed.engineId !== 'string' || !parsed.engineId.trim()) return null;
    const mode = parsed.mode === 't2i' || parsed.mode === 'i2i' ? parsed.mode : undefined;
    return { engineId: parsed.engineId, mode };
  } catch {
    return null;
  }
}

export function persistVideoSelection(engineId: string, mode: Mode): void {
  if (typeof window === 'undefined') return;
  const payload: Record<string, unknown> = {
    engineId,
    mode,
    updatedAt: Date.now(),
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.form);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(payload, parsed);
        payload.engineId = engineId;
        payload.mode = mode;
        payload.updatedAt = Date.now();
      }
    }
  } catch {
    // ignore storage parse failures
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export function persistImageSelection(engineId: string, mode: Mode): void {
  if (typeof window === 'undefined') return;
  const payload: Record<string, unknown> = {
    version: 2,
    engineId,
    mode: mode === 't2i' || mode === 'i2i' ? mode : 't2i',
    prompt: '',
    numImages: 1,
    aspectRatio: null,
    resolution: null,
    seed: null,
    outputFormat: null,
    enableWebSearch: false,
    thinkingLevel: null,
    limitGenerations: false,
    referenceSlots: [],
    characterReferences: [],
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.imageForm);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        if (typeof record.prompt === 'string') {
          payload.prompt = record.prompt;
        }
        if (typeof record.numImages === 'number' && Number.isFinite(record.numImages)) {
          payload.numImages = Math.round(record.numImages);
        }
        if (typeof record.aspectRatio === 'string' || record.aspectRatio === null) {
          payload.aspectRatio = record.aspectRatio;
        }
        if (typeof record.resolution === 'string' || record.resolution === null) {
          payload.resolution = record.resolution;
        }
        if (typeof record.seed === 'number' && Number.isFinite(record.seed)) {
          payload.seed = Math.round(record.seed);
        }
        if (typeof record.outputFormat === 'string' || record.outputFormat === null) {
          payload.outputFormat = record.outputFormat;
        }
        if (record.enableWebSearch === true) {
          payload.enableWebSearch = true;
        }
        if (typeof record.thinkingLevel === 'string' || record.thinkingLevel === null) {
          payload.thinkingLevel = record.thinkingLevel;
        }
        if (record.limitGenerations === true) {
          payload.limitGenerations = true;
        }
      }
    }
  } catch {
    // ignore storage parse failures
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.imageForm, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

export function readTemplates(): TemplateEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.templates);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TemplateEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry.id === 'string' && entry.id.length > 0)
      .map((entry) => ({
        id: entry.id,
        prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
        engineLabel: typeof entry.engineLabel === 'string' ? entry.engineLabel : null,
        engineId: typeof entry.engineId === 'string' ? entry.engineId : null,
        thumbUrl: typeof entry.thumbUrl === 'string' ? entry.thumbUrl : null,
        durationSec:
          typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec)
            ? entry.durationSec
            : null,
        aspectRatio: typeof entry.aspectRatio === 'string' ? entry.aspectRatio : null,
        hasAudio: typeof entry.hasAudio === 'boolean' ? entry.hasAudio : null,
        priceCents:
          typeof entry.priceCents === 'number' && Number.isFinite(entry.priceCents) ? entry.priceCents : null,
        currency: typeof entry.currency === 'string' ? entry.currency : null,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : null,
      }));
  } catch {
    return [];
  }
}

export function writeTemplates(templates: TemplateEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

